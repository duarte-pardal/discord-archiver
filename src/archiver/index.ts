// Node.js sometimes doesn't show the rejection reason if it's not an instance of Error
process.on("unhandledRejection", (err) => {
	throw err;
});
process.on("uncaughtExceptionMonitor", () => {
	setProgress();
	console.error("ERROR: An unexpected error happened! Please report this.");
});

import * as DT from "../discord-api/types.js";
import { AddSnapshotResult, getDatabaseConnection, RequestType } from "../db/index.js";
import { GatewayConnection } from "../discord-api/gateway/connection.js";
import { apiReq, RequestResult } from "../discord-api/rest.js";
import { computeChannelPermissions, computeGuildPermissions, hasChannelPermissions } from "./permissions.js";
import { setProgress } from "../util/progress-display.js";
import { areMapsEqual } from "../util/map-equality.js";
import { abortError, waitForAbort } from "../util/abort.js";
import { parseArgs, ParseArgsConfig } from "node:util";
import log from "../util/log.js";
import { getTag } from "../discord-api/tag.js";
import { RateLimiter } from "../util/rate-limiter.js";
import { CachedChannel, CachedChannelWithSyncInfo, CachedGuild, createCachedChannel, extractThreadInfo, guilds, isChannelCacheable, ThreadInfo } from "./cache.js";
import { Account, AccountOptions, accounts, getLeastGatewayOccupiedAccount, getLeastRESTOccupiedAccount, OngoingOperation } from "./accounts.js";
import { ArchivedThreadSyncProgress, downloadProgresses, MessageSyncProgress, progressCounts, startProgressDisplay, stopProgressDisplay, updateProgressOutput } from "./progress.js";
import { closeFileStore, CurrentDownload, downloadFileIfNeeded, openFileStore, performFileTransaction } from "./files.js";
import { mergeOptions } from "../util/http.js";
import { promiseWithResolvers } from "../util/promise.js";
import { mapIterator } from "../util/iterators.js";
import { setMaxListeners } from "node:events";

setMaxListeners(100);

const args = {
	strict: true,
	allowPositionals: true,
	options: {
		token: {
			type: "string",
			multiple: true,
		},
		log: {
			type: "string",
		},
		stats: {
			type: "string",
		},
		"sync-sqlite": {
			type: "boolean",
		},
		"file-store-path": {
			type: "string",
		},
		guild: {
			type: "string",
			multiple: true,
		},
		"no-sync": {
			type: "boolean",
		},
		"no-reactions": {
			type: "boolean",
		},
		"no-files": {
			type: "boolean",
		},
	},
} satisfies ParseArgsConfig;

let options: ReturnType<typeof parseArgs<typeof args>>["values"], positionals: string[];
let stats: boolean;
try {
	({
		values: options,
		positionals,
	} = parseArgs(args));
	if (positionals.length !== 1 || options.token === undefined) {
		throw undefined;
	}
	log.setLevel(options.log ?? "info");
	switch (options.stats) {
		case "yes":
			stats = true;
			break;
		case "no":
			stats = false;
			break;
		case "auto":
		case undefined:
			stats = process.stderr.isTTY;
			break;
		default:
			throw undefined;
	}
} catch {
	console.error("\
Usage: node index.js --token <token> [--log (error | warning | info | verbose | debug)] [--stats (yes | no | auto)] [(--guild <guild id>)…] [--no-sync] [--no-reactions] [--no-files] [--file-store-path <path>] <database path>");
	process.exit(1);
}

if (stats) {
	startProgressDisplay();
}

const fileStorePath = options["file-store-path"] ?? `${positionals[0]}-files`;

const dbOpenTimestamp = Date.now();
const db = await getDatabaseConnection(positionals[0], options["sync-sqlite"] ?? false);
db.ready.then(() => {
	log.verbose?.(`Successfully opened the database in ${Date.now()-dbOpenTimestamp} ms.`);
});

const globalAbortController = new AbortController();
const globalAbortSignal = globalAbortController.signal;

let allReady = false;

// SYNCING


// TODO: This can be optimized. We don't need to wait for all reactions/files from the previous
// message to be downloaded to start downloading the ones from the next message.
export async function syncMessages(account: Account, channel: CachedChannel | ThreadInfo): Promise<void> {
	const lastMessageID = channel.syncInfo?.lastMessageID;
	const parentChannel = channel.parent ?? channel;

	const abortController = new AbortController();
	const restOptions = mergeOptions(account.restOptions, { signal: abortController.signal });

	// Add this operation to the ongoing syncs list
	const { promise: end, resolve: endOperation } = promiseWithResolvers<void>();
	const sync = { abortController, end, channel };
	const ongoingSyncs = channel.parent !== null && channel.private ?
		account.ongoingPrivateThreadMessageSyncs :
		account.ongoingMessageSyncs;
	let ongoingChannelSyncs = ongoingSyncs.get(parentChannel);
	if (ongoingChannelSyncs !== undefined) {
		ongoingChannelSyncs.set(channel.id, sync);
	} else {
		ongoingChannelSyncs = new Map([[channel.id, sync]]);
		ongoingSyncs.set(parentChannel, ongoingChannelSyncs);
	}
	account.numberOfOngoingRESTOperations++;

	// Check if it is necessary to sync this channel based on last_message_id and the id of the last stored message
	const lastStoredMessageID = await db.request({ type: RequestType.GetLastMessageID, channelID: channel.id });
	if (lastMessageID == null || lastStoredMessageID == null || lastStoredMessageID < BigInt(lastMessageID)) {
		log.verbose?.(`${lastStoredMessageID == null ? "Started" : "Resumed"} syncing messages from #${channel.name} (${channel.id})${lastStoredMessageID == null ? "" : ` after message ${lastStoredMessageID}`} using ${account.name}.`);

		progressCounts.messageSyncs++;
		const progress: MessageSyncProgress = {
			channel,
			progress: 0,
		};
		downloadProgresses.add(progress);
		updateProgressOutput();

		const lastMessageIDNum = lastMessageID != null ? Number.parseInt(lastMessageID) : null;
		let firstMessageIDNum: number | undefined;

		let messageID = lastStoredMessageID?.toString() ?? "0";

		function updateProgress(currentID: string, count: number) {
			progress.progress = lastMessageIDNum === null ? null : (Number.parseInt(currentID) - firstMessageIDNum!) / (lastMessageIDNum - firstMessageIDNum!);
			progressCounts.messagesArchived += count;
			updateProgressOutput();
		}

		main:
		while (true) {
			try {
				const { response, data, rateLimitReset } = await account.request<DT.Message[]>(`/channels/${channel.id}/messages?limit=100&after=${messageID}`, restOptions, true);
				if (abortController.signal.aborted) throw abortError;
				if (response.status === 403 || response.status === 404) {
					// TODO: Maybe not ideal?
					log.verbose?.(`Hanging message sync from #${channel.name} (${channel.id}) using ${account.name} because we got a ${response.status} ${response.statusText} response.`);
					await waitForAbort(abortController.signal);
					throw abortError;
				} else if (!response.ok) {
					log.warning?.(`Stopped syncing messages from #${channel.name} (${channel.id}) using ${account.name} because we got a ${response.status} ${response.statusText} response.`);
					break;
				}

				const messages = data!;

				if (messages.length > 0) {
					// Messages must be added from oldest to newest so that the program can detect
					// which messages need to be archived solely based on the ID of the last archived message.
					// Every message with reactions or downloadable files is added on its own transaction.
					// The other messages (simple messages) are grouped together in a single transaction to
					// improve performance.

					firstMessageIDNum ??= Number.parseInt(messages.at(-1)!.id);
					messageID = messages[0].id;

					let lastMessageAddPromise: Promise<AddSnapshotResult>;
					let rateLimitReset: Promise<void> | undefined;
					let i: number;
					let simpleMessagesStartIndex: number = messages.length - 1;

					function flushSimpleMessages() {
						if (simpleMessagesStartIndex === i) return;
						// Since the message array is iterated in reverse, startIndex > endIndex.
						const startIndex = simpleMessagesStartIndex; // inclusive
						const endIndex = i; // exclusive
						updateProgress(messages[endIndex + 1].id, startIndex - endIndex);
						db.transaction(async () => {
							for (let j = startIndex; j > endIndex; j--) {
								lastMessageAddPromise = db.request({
									type: RequestType.AddMessageSnapshot,
									message: messages[j],
								});
							}
						});
					}

					for (i = messages.length - 1; i >= 0; i--) {
						const message = messages[i];


						// Download files, including attachments and embedded media

						const filesToDownload: { url: string; downloadURL: string }[] = [];

						if (!options["no-files"]) {
							// TODO: Clean this up
							function stripQuery(url: string) {
								const i = url.indexOf("?");
								return i === -1 ? url : url.slice(0, i);
							}
							function normalizeURL(url: string) {
								if (/^https?:\/\/cdn\.discordapp\.com\/attachments\//.test(url)) url = stripQuery(url);
								return url;
							}

							for (const attachment of message.attachments) {
								const normalizedURL = stripQuery(attachment.url);

								if (log.warning) {
									// Verify if the URL matches what's expected
									const path = `/attachments/${
										(message.flags ?? 0) & DT.MessageFlags.IsCrosspost ? message.message_reference?.channel_id : message.channel_id
									}/${attachment.id}/${attachment.filename}`;
									if (
										normalizedURL !== `https://cdn.discordapp.com${path}` ||
										stripQuery(attachment.proxy_url) !== `https://media.discordapp.net${path}`
									) {
										log.warning("WARNING: The attachment URLs differ from the expected.\nurl: %o\nproxy_url: %o\nexpected path: %o\n", attachment.url, attachment.proxy_url, path);
									}
								}

								filesToDownload.push({ url: normalizedURL, downloadURL: attachment.url });
							}
							for (const embed of message.embeds) {
								if (embed.footer?.icon_url != undefined && embed.footer.proxy_icon_url != undefined) {
									filesToDownload.push({ url: normalizeURL(embed.footer.icon_url), downloadURL: embed.footer.proxy_icon_url });
								}
								if (embed.image?.url != undefined && embed.image.proxy_url != undefined) {
									filesToDownload.push({ url: normalizeURL(embed.image.url), downloadURL: embed.image.proxy_url });
								}
								if (embed.thumbnail?.url != undefined && embed.thumbnail.proxy_url != undefined) {
									filesToDownload.push({ url: normalizeURL(embed.thumbnail.url), downloadURL: embed.thumbnail.proxy_url });
								}
								if (embed.video?.url != undefined && embed.video.proxy_url != undefined) {
									filesToDownload.push({ url: normalizeURL(embed.video.url), downloadURL: embed.video.proxy_url });
								}
								if (embed.author?.icon_url != undefined && embed.author.proxy_icon_url != undefined) {
									filesToDownload.push({ url: normalizeURL(embed.author.icon_url), downloadURL: embed.author.proxy_icon_url });
								}
							}
							if (message.author.avatar != null) {
								const avatarURL = `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.webp?size=4096&quality=lossless`;
								filesToDownload.push({ url: avatarURL, downloadURL: avatarURL });
							}
						}

						if (
							(!options["no-reactions"] && message.reactions !== undefined && message.reactions.length !== 0) ||
							filesToDownload.length > 0
						) {
							flushSimpleMessages();
							simpleMessagesStartIndex = i - 1;

							const reactions: {
								emoji: DT.PartialEmoji;
								reactionType: 0 | 1;
								userIDs: string[];
							}[] = [];

							for (const reaction of message.reactions ?? []) {
								for (const [reactionType, expectedCount] of [
									...(reaction.count_details.normal > 0 ? [[0, reaction.count_details.normal]] : []),
									...(reaction.count_details.burst > 0 ? [[1, reaction.count_details.burst]] : []),
								] as [0 | 1, number][]) {
									const reactionData = {
										emoji: reaction.emoji,
										reactionType,
										userIDs: new Array<string>(expectedCount),
									};
									let i = 0;
									const emoji = reaction.emoji.id === null ? reaction.emoji.name : `${reaction.emoji.name}:${reaction.emoji.id}`;

									let userID = "0";
									while (true) {
										await rateLimitReset;
										let response, data: DT.PartialUser[] | undefined;
										({ response, data, rateLimitReset } = await account.request<DT.PartialUser[]>(`/channels/${channel.id}/messages/${message.id}/reactions/${emoji}?limit=100&type=${reactionType}&after=${userID}`, restOptions, true));
										if (abortController.signal.aborted as boolean) throw abortError;
										if (response.status === 403 || response.status === 404) {
											// TODO: Maybe not ideal?
											log.verbose?.(`Hanging message sync from #${channel.name} (${channel.id}) using ${account.name} because we got a ${response.status} ${response.statusText} response.`);
											await waitForAbort(abortController.signal);
											throw abortError;
										} else if (!response.ok) {
											log.warning?.(`Stopped syncing messages from #${channel.name} (${channel.id}) using ${account.name} because we got a ${response.status} ${response.statusText} response.`);
											break main;
										}
										const users = data!;

										for (const user of users) {
											reactionData.userIDs[i] = user.id;
											i++;
										}

										if (users.length < 100) {
											break;
										}
										userID = users.at(-1)!.id;
									}
									reactions.push(reactionData);

									if (i !== expectedCount) {
										log.verbose?.(`The reaction count (${expectedCount}) is different from the length of the list (${i}) of users who reacted to the message with ID ${message.id} from #${channel.name} (${channel.id}).`);
									}
								}
							}

							const downloads = filesToDownload.map(({ url, downloadURL }) => downloadFileIfNeeded(fileStorePath, db, url, downloadURL));
							await performFileTransaction(fileStorePath, db, abortController.signal, downloads, async () => {
								lastMessageAddPromise = db.request({
									type: RequestType.AddMessageSnapshot,
									message,
								});
								for (const reactionData of reactions) {
									db.request({
										type: RequestType.AddInitialReactions,
										messageID: message.id,
										emoji: reactionData.emoji,
										reactionType: reactionData.reactionType,
										userIDs: reactionData.userIDs,
										timing: null,
									});
								}
							});

							updateProgress(message.id, 1);
						}
					}
					flushSimpleMessages();

					// Since there is at least 1 message, the promise variable will always be defined
					const done = await lastMessageAddPromise! !== AddSnapshotResult.AddedFirstSnapshot;

					if (done) {
						// The last message was already in the database, so we reached the
						// point where we started getting messages from the gateway.
						log.verbose?.(`Finished syncing messages from #${channel.name} (${channel.id}) because a known message (${messages[0].id}) was found.`);
						break;
					}
				}

				if (messages.length < 100) {
					log.verbose?.(`Finished syncing messages from #${channel.name} (${channel.id}) using ${account.name}.`);
					progress.progress = 1;
					updateProgressOutput();
					break;
				}

				await rateLimitReset;
			} catch (err) {
				if (err === abortError) {
					log.verbose?.(`Stopped syncing messages from #${channel.name} (${channel.id}) using ${account.name}.`);
					break;
				}
				throw err;
			}
		}

		progressCounts.messageSyncs--;
		downloadProgresses.delete(progress);
		updateProgressOutput();
	}

	// Remove this operation from the ongoing syncs list
	if (ongoingChannelSyncs.size > 1) {
		ongoingChannelSyncs.delete(channel.id);
	} else {
		ongoingSyncs.delete(parentChannel);
	}
	account.numberOfOngoingRESTOperations--;
	endOperation();
}

export function syncMessagesIfNotSyncing(account: Account, channel: CachedChannel | ThreadInfo): Promise<void> {
	if (channel.parent === null && channel.guild === null) throw new TypeError();
	const parentChannel = channel.parent ?? channel;
	for (const account of parentChannel.guild!.accountData.keys()) {
		if (account.ongoingMessageSyncs.get(parentChannel)?.has(channel.id)) {
			return Promise.resolve();
		}
	}
	return syncMessages(account, channel);
}

// TODO: This assumes that the thread enumeration is not interrupted
enum ArchivedThreadListType {
	Public,
	Private,
	JoinedPrivate,
}
async function syncAllArchivedThreads(account: Account, channel: CachedChannel, type: ArchivedThreadListType) {
	log.verbose?.(`Started enumerating ${ArchivedThreadListType[type]} archived threads from #${channel.name} (${channel.id}) using ${account.name}.`);

	progressCounts.threadEnumerations++;
	const progress: ArchivedThreadSyncProgress = {
		channel,
		progress: null,
	};
	downloadProgresses.add(progress);
	updateProgressOutput();

	const abortController = new AbortController();
	const restOptions = mergeOptions(account.restOptions, { signal: abortController.signal });

	const { promise: end, resolve: endOperation } = promiseWithResolvers<void>();
	const ongoingMap =
		type === ArchivedThreadListType.Public ? account.ongoingPublicThreadListSyncs :
		type === ArchivedThreadListType.Private ? account.ongoingPrivateThreadListSyncs :
		account.ongoingJoinedPrivateThreadListSyncs;
	ongoingMap.set(channel, { abortController, end });

	let threadID = "";
	while (true) {
		try {
			const { response, data, rateLimitReset } = await account.request<DT.ListThreadsResponse>(
				type === ArchivedThreadListType.Public ? `/channels/${channel.id}/threads/archived/public?limit=100&before=${threadID}` :
				type === ArchivedThreadListType.Private ? `/channels/${channel.id}/threads/archived/private?limit=100&before=${threadID}` :
				`/channels/${channel.id}/users/@me/threads/archived/private?limit=100&before=${threadID}`,
				restOptions,
				true,
			);
			if (abortController.signal.aborted) throw abortError;
			if (response.status === 403 || response.status === 404) {
				// TODO: Maybe not ideal?
				log.verbose?.(`Hanging ${ArchivedThreadListType[type]} archived thread enumeration from #${channel.name} (${channel.id}) using ${account.name} because we got a ${response.status} ${response.statusText} response.`);
				await waitForAbort(abortController.signal);
				throw abortError;
			} else if (!response.ok) {
				log.warning?.(`Stopped enumerating ${ArchivedThreadListType[type]} archived threads from #${channel.name} (${channel.id}) using ${account.name} because we got a ${response.status} ${response.statusText} response.`);
				break;
			}
			const timestamp = Date.now();
			const list = data!;

			if (list.threads.length > 0) {
				db.transaction(async () => {
					for (let i = list.threads.length - 1; i >= 0; i--) {
						db.request({
							type: RequestType.AddChannelSnapshot,
							channel: list.threads[i],
							timing: {
								timestamp,
								realtime: false,
							},
						});
					}
				});

				// TODO: The program will always attempt to sync all threads at the same time.
				// This means that the memory usage is proportional to the number of threads.
				for (const thread of list.threads) {
					// channel.accountsWithReadPermission is guaranteed to have an account because
					// if it doesn't, this sync would have been aborted.
					syncMessages(getLeastRESTOccupiedAccount(channel.accountsWithReadPermission)!, extractThreadInfo(thread, channel));
				}

				threadID = list.threads.at(-1)!.id;
			}
			if (!list.has_more) {
				log.verbose?.(`Finished enumerating ${ArchivedThreadListType[type]} archived threads from #${channel.name} (${channel.id}) using ${account.name}.`);
				break;
			}

			await rateLimitReset;
		} catch (err) {
			if (err === abortError) {
				log.verbose?.(`Stopped enumerating ${ArchivedThreadListType[type]} archived threads from #${channel.name} (${channel.id}) using ${account.name}.`);
				break;
			}
			throw err;
		}
	}

	ongoingMap.delete(channel);
	account.numberOfOngoingRESTOperations--;
	endOperation();

	progressCounts.threadEnumerations--;
	downloadProgresses.delete(progress);
	updateProgressOutput();
}


// GATEWAY

function updateGuildPermissions(cachedGuild: CachedGuild) {
	for (const cachedChannel of cachedGuild.textChannels.values()) {
		updateGuildChannelPermissions(cachedChannel);
	}
}

/**
 * Updates the account sets in the cached channel object and aborts syncs for accounts which lost
 * permission.
 */
function updateGuildChannelPermissions(cachedChannel: CachedChannel) {
	const accountWithReadPermExisted = cachedChannel.accountsWithReadPermission.size > 0;
	const accountWithManagePermExisted = cachedChannel.accountsWithManageThreadsPermission.size > 0;
	const accountsThatLostReadPermission = new Set<Account>();
	const accountsThatLostManageThreadsPermission = new Set<Account>();

	for (const [account, accountData] of cachedChannel.guild!.accountData.entries()) {
		const permissions = computeChannelPermissions(account, cachedChannel.guild!, cachedChannel, accountData);
		const hasReadPermission = hasChannelPermissions(permissions, DT.Permission.ReadMessageHistory);
		const hasManageThreadsPermission = hasReadPermission && hasChannelPermissions(permissions, DT.Permission.ManageThreads);

		if (hasReadPermission) {
			cachedChannel.accountsWithReadPermission.add(account);
			account.references.add(cachedChannel.accountsWithReadPermission);
		} else if (cachedChannel.accountsWithReadPermission.has(account)) {
			cachedChannel.accountsWithReadPermission.delete(account);
			account.references.delete(cachedChannel.accountsWithReadPermission);
			accountsThatLostReadPermission.add(account);
		}

		if (hasManageThreadsPermission) {
			cachedChannel.accountsWithManageThreadsPermission.add(account);
			account.references.add(cachedChannel.accountsWithManageThreadsPermission);
		} else if (cachedChannel.accountsWithReadPermission.has(account)) {
			cachedChannel.accountsWithManageThreadsPermission.delete(account);
			account.references.delete(cachedChannel.accountsWithManageThreadsPermission);
			accountsThatLostManageThreadsPermission.add(account);
		}
	}

	if (!options["no-sync"] && (
		cachedChannel.guild === null ||
		options.guild === undefined ||
		options.guild.includes(cachedChannel.guild.id)
	)) {
		// Abort all message syncs and switch to new account if possible
		for (const account of accountsThatLostReadPermission) {
			for (const sync of account.ongoingMessageSyncs.get(cachedChannel)?.values() ?? []) {
				sync.abortController.abort();
				const newAccount = getLeastRESTOccupiedAccount(cachedChannel.accountsWithReadPermission);
				if (newAccount !== undefined) {
					syncMessages(newAccount, sync.channel);
				}
			}
		}
		// Abort all private thread list and private thread message syncs and switch to new account if possible
		for (const account of accountsThatLostManageThreadsPermission) {
			account.ongoingPrivateThreadListSyncs.get(cachedChannel)?.abortController.abort();
			const newAccount = getLeastRESTOccupiedAccount(cachedChannel.accountsWithManageThreadsPermission);
			if (newAccount) {
				// TODO: Switch thread enumeration to the other account
			}
			for (const sync of account.ongoingPrivateThreadMessageSyncs.get(cachedChannel)?.values() ?? []) {
				sync.abortController.abort();
				const newAccount = getLeastRESTOccupiedAccount(cachedChannel.accountsWithManageThreadsPermission);
				if (newAccount !== undefined) {
					syncMessages(newAccount, sync.channel);
				}
			}
		}

		if (allReady) {
			if (!accountWithReadPermExisted && cachedChannel.accountsWithReadPermission.size > 0) {
				log.verbose?.(`We gained permission to read channel #${cachedChannel.name} (${cachedChannel.id}).`);
				syncMessages(getLeastRESTOccupiedAccount(cachedChannel.accountsWithReadPermission)!, cachedChannel);
				syncAllArchivedThreads(getLeastRESTOccupiedAccount(cachedChannel.accountsWithReadPermission)!, cachedChannel, ArchivedThreadListType.Public);
			}
			if (!accountWithManagePermExisted && cachedChannel.accountsWithManageThreadsPermission.size > 0) {
				log.verbose?.(`We gained permission to manage channel #${cachedChannel.name} (${cachedChannel.id}).`);
				syncAllArchivedThreads(getLeastRESTOccupiedAccount(cachedChannel.accountsWithManageThreadsPermission)!, cachedChannel, ArchivedThreadListType.Private);
			}
		}
	}
}

function syncAllGuildMembers(account: Account, cachedGuild: CachedGuild) {
	log.verbose?.(`Requesting all guild members from ${cachedGuild.name} (${cachedGuild.id}) using ${account.name}.`);
	account.ongoingMemberRequests.add(cachedGuild.id);
	account.numberOfOngoingGatewayOperations++;
	account.gatewayConnection.sendPayload({
		op: DT.GatewayOpcode.RequestGuildMembers,
		d: {
			guild_id: cachedGuild.id,
			query: "",
			limit: 0,
		},
	});
}

function connectAccount(accountOptions: AccountOptions): Promise<void> {
	return new Promise((res, rej) => {
		const bot = accountOptions.mode === "bot";

		let ready = false;

		/** The number of guilds left to receive a Guild Create event for. Only used for bots. */
		let numberOfGuildsLeft: number;
		function receivedGuildInfo() {
			if (bot && !ready) {
				numberOfGuildsLeft--;
				if (numberOfGuildsLeft === 0) {
					ready = true;
					res();
				}
			}
		}

		const gatewayConnection = new GatewayConnection({
			identifyData: accountOptions.gatewayIdentifyData,
		});

		gatewayConnection.addListener("connecting", () => {
			log.verbose?.(`Connecting to the gateway using ${account.name}.`);
		});
		gatewayConnection.addListener("connectionLost", (wasConnected: boolean, code: number) => {
			log.verbose?.(`${wasConnected ? "Gateway connection lost" : "Failed to connect to the gateway"} (code: ${code}) using ${account.name}.`);
		});

		gatewayConnection.addListener("dispatch", async (payload: DT.GatewayDispatchPayload, realtime: boolean) => {
			const timestamp = Date.now();
			const timing = {
				timestamp,
				realtime,
			};

			const abortController = new AbortController();
			const { promise: end, resolve: endOperation } = promiseWithResolvers<void>();
			const operation: OngoingOperation = {
				abortController,
				end,
			};
			account.ongoingDispatchHandlers.add(operation);

			try {
				switch (payload.t) {
					case "READY": {
						account.details = {
							id: payload.d.user.id,
							tag: getTag(payload.d.user),
						};
						log.info?.(`Gateway connection ready for ${account.name} (${account.details.tag}).`);
						numberOfGuildsLeft = payload.d.guilds.length;
						break;
					}

					case "GUILD_DELETE": {
						if (payload.d.unavailable) {
							receivedGuildInfo();
						}
						break;
					}

					case "GUILD_CREATE": {
						receivedGuildInfo();
						let cachedGuild: CachedGuild;
						const guild = payload.d;
						const rolePermissions = new Map(guild.roles.map(r => [r.id, BigInt(r.permissions)]));
						const ownMember = guild.members.find(m => m.user.id === account.details!.id)!;

						if (!guilds.has(guild.id)) {
							const iconDownloads: CurrentDownload[] = [];
							if (!options["no-files"] && guild.icon != null) {
								const iconURL = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=4096&quality=lossless`;
								iconDownloads.push(downloadFileIfNeeded(fileStorePath, db, iconURL, iconURL));
							}

							// Will be awaited below.
							const initialSyncPromise = performFileTransaction(fileStorePath, db, abortController.signal, iconDownloads, async () => {
								db.request({
									type: RequestType.SyncGuildChannelsAndRoles,
									guildID: BigInt(guild.id),
									channelIDs: new Set(guild.channels.map(c => BigInt(c.id))),
									roleIDs: new Set(guild.roles.map(r => BigInt(r.id))),
									timing: {
										timestamp,
										realtime: false,
									},
								});

								db.request({
									type: RequestType.AddGuildSnapshot,
									guild,
									timing: {
										timestamp,
										realtime: false,
									},
								});

								for (const role of guild.roles) {
									db.request({
										type: RequestType.AddRoleSnapshot,
										role,
										guildID: guild.id,
										timing: {
											timestamp,
											realtime: false,
										},
									});
								}

								for (const channel of guild.channels) {
									db.request({
										type: RequestType.AddChannelSnapshot,
										channel: Object.assign(channel, { guild_id: guild.id }),
										timing: {
											timestamp,
											realtime: false,
										},
									});
								}

								for (const thread of guild.threads) {
									db.request({
										type: RequestType.AddChannelSnapshot,
										channel: Object.assign(thread, { guild_id: guild.id }),
										timing: {
											timestamp,
											realtime: false,
										},
									});
								}
							});

							cachedGuild = {
								id: guild.id,
								name: guild.name,
								ownerID: guild.owner_id,
								rolePermissions,
								accountData: new Map(),
								textChannels: new Map(),
								memberUserIDs: new Set(),
								initialSyncPromise,
							};
							cachedGuild.textChannels = new Map(
								(payload.d.channels.filter(isChannelCacheable)).map(c => [c.id, createCachedChannel(c, cachedGuild)]),
							);
							guilds.set(guild.id, cachedGuild);
							for (const channel of cachedGuild.textChannels.values()) {
								channel.guild = cachedGuild;
							}
							for (const thread of guild.threads) {
								const parent = cachedGuild.textChannels.get(thread.parent_id)!;
								parent.syncInfo!.activeThreads.add(extractThreadInfo(thread, parent));
							}

							cachedGuild.accountData.set(account, {
								roles: new Set(ownMember.roles),
								guildPermissions: computeGuildPermissions(account, cachedGuild, ownMember.roles),
							});
							updateGuildPermissions(cachedGuild);

							updateProgressOutput();

							await initialSyncPromise;
							log.verbose?.(`Synced basic guild info for ${cachedGuild.name} (${cachedGuild.id}) using ${account.name}.`);
						} else {
							cachedGuild = guilds.get(guild.id)!;
						}

						if (allReady) {
							const syncAccount = getLeastGatewayOccupiedAccount(cachedGuild.accountData.keys());
							if (syncAccount !== undefined) {
								syncAllGuildMembers(syncAccount, cachedGuild);
							}
							// TODO: Resync
						}

						break;
					}
					case "GUILD_UPDATE": {
						// This assumes that no permission changes are caused by this event.
						await db.transaction(async () => {
							db.request({
								type: RequestType.AddGuildSnapshot,
								guild: payload.d,
								timing,
							});
						});
						break;
					}

					case "GUILD_ROLE_CREATE":
					case "GUILD_ROLE_UPDATE":
					{
						const cachedGuild = guilds.get(payload.d.guild_id);
						if (cachedGuild === undefined) {
							log.warning?.(`Received guild role ${payload.t === "GUILD_ROLE_CREATE" ? "create" : "update"} event for an unknown guild with ID ${payload.d.guild_id}.`);
							break;
						}
						await cachedGuild.initialSyncPromise;

						const perms = BigInt(payload.d.role.permissions);

						if (payload.t === "GUILD_ROLE_CREATE") {
							cachedGuild.rolePermissions.set(payload.d.role.id, perms);
						} else if (cachedGuild.rolePermissions.get(payload.d.role.id) !== perms) {
							// TODO: Recompute permissions only for accounts with the role
							// (also for role deletion and role list updates)
							log.verbose?.(`Role with ID ${payload.d.role.id} from guild ${cachedGuild.name} (${payload.d.guild_id}) was updated.`);
							cachedGuild.rolePermissions.set(payload.d.role.id, perms);
							updateGuildPermissions(cachedGuild);
						}

						await db.transaction(async () => {
							db.request({
								type: RequestType.AddRoleSnapshot,
								role: payload.d.role,
								guildID: payload.d.guild_id,
								timing,
							});
						});
						break;
					}
					case "GUILD_ROLE_DELETE": {
						const cachedGuild = guilds.get(payload.d.guild_id);
						if (cachedGuild === undefined) {
							log.warning?.(`Received guild role delete event for an unknown guild with ID ${payload.d.guild_id}.`);
							break;
						}
						await cachedGuild.initialSyncPromise;
						if (cachedGuild.rolePermissions.has(payload.d.role_id)) {
							log.verbose?.(`Role with ID ${payload.d.role_id} from guild ${cachedGuild.name} (${payload.d.guild_id}) was deleted.`);
							cachedGuild.rolePermissions.delete(payload.d.role_id);
							updateGuildPermissions(cachedGuild);
						}

						await db.transaction(async () => {
							db.request({
								type: RequestType.MarkRoleAsDeleted,
								id: payload.d.role_id,
								timing,
							});
						});
						break;
					}

					case "GUILD_MEMBERS_CHUNK": {
						const isLast = payload.d.chunk_index === payload.d.chunk_count - 1;
						const cachedGuild = guilds.get(payload.d.guild_id);
						if (cachedGuild === undefined) {
							log.warning?.(`Received guild members chunk for an unknown guild with ID ${payload.d.guild_id}.`);
						} else {
							await cachedGuild.initialSyncPromise;
							for (const member of payload.d.members) {
								// BUG: `cachedGuild.memberUserIDs` is sometimes `null`
								cachedGuild.memberUserIDs!.add(BigInt(member.user.id));
							}
							if (isLast) {
								log.verbose?.(`Finished requesting guild members from ${cachedGuild.name} (${cachedGuild.id}) using ${account.name}.`);
								db.transaction(async () => {
									db.request({
										type: RequestType.SyncGuildMembers,
										guildID: BigInt(cachedGuild.id),
										userIDs: cachedGuild.memberUserIDs!,
										timing: {
											timestamp,
											realtime: false,
										},
									});
								});
							}
						}
						if (isLast) {
							account.ongoingMemberRequests.delete(payload.d.guild_id);
							account.numberOfOngoingGatewayOperations--;
						}

						const avatarDownloads: CurrentDownload[] = [];
						if (!options["no-files"]) {
							for (const { user } of payload.d.members) {
								if (user.avatar != null) {
									const iconURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=4096&quality=lossless`;
									avatarDownloads.push(downloadFileIfNeeded(fileStorePath, db, iconURL, iconURL));
								}
							}
						}

						await performFileTransaction(fileStorePath, db, abortController.signal, avatarDownloads, async () => {
							for (const member of payload.d.members) {
								db.request({
									type: RequestType.AddUserSnapshot,
									user: member.user,
									timing: {
										timestamp,
										realtime: false,
									},
								});
								db.request({
									type: RequestType.AddMemberSnapshot,
									partial: false,
									member,
									guildID: payload.d.guild_id,
									userID: member.user.id,
									timing: {
										timestamp,
										realtime: false,
									},
								});
							}
						});
						break;
					}

					case "GUILD_MEMBER_ADD": {
						await db.transaction(async () => {
							db.request({
								type: RequestType.AddMemberSnapshot,
								partial: false,
								member: payload.d,
								guildID: payload.d.guild_id,
								userID: payload.d.user.id,
								timing,
							});
						});
						break;
					}
					case "GUILD_MEMBER_UPDATE": {
						const member = payload.d;
						const cachedGuild = guilds.get(member.guild_id);
						if (cachedGuild === undefined) {
							log.warning?.(`Received guild member update event for an unknown guild with ID ${payload.d.guild_id}.`);
							break;
						}
						await cachedGuild.initialSyncPromise;
						for (const [account, accountData] of cachedGuild.accountData) {
							if (account.details!.id === member.user.id) {
								if (
									member.roles.length !== accountData.roles.size ||
									member.roles.some(id => !accountData.roles.has(id))
								) {
									log.verbose?.(`Role list in guild ${cachedGuild.name} (${cachedGuild.id}) updated for ${account.name}.`);
									accountData.roles = new Set(member.roles);
									updateGuildPermissions(cachedGuild);
								}
								break;
							}
						}

						// It seems that the API always returns a full member
						// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
						if (member.joined_at == null) {
							log.warning?.("`joined_at` is missing on a guild member update event. This snapshot won't be recorded.");
						} else {
							await db.transaction(async () => {
								db.request({
									type: RequestType.AddMemberSnapshot,
									partial: false,
									member: member as DT.GuildMember,
									guildID: member.guild_id,
									userID: member.user.id,
									timing,
								});
							});
						}
						break;
					}
					case "GUILD_MEMBER_REMOVE": {
						const member = payload.d;
						const cachedGuild = guilds.get(member.guild_id);
						if (cachedGuild === undefined) {
							log.warning?.(`Received guild member update event for an unknown guild with ID ${payload.d.guild_id}.`);
							break;
						}
						await cachedGuild.initialSyncPromise;
						await db.transaction(async () => {
							db.request({
								type: RequestType.AddMemberLeave,
								guildID: payload.d.guild_id,
								userID: payload.d.user.id,
								timing,
							});
						});
						break;
					}

					// TODO: It's not a great idea to add channels and messages to the database unconditionally.

					case "CHANNEL_CREATE": {
						const channel = payload.d;
						if (isChannelCacheable(channel)) {
							const cachedGuild = guilds.get(channel.guild_id);
							if (cachedGuild === undefined) {
								log.warning?.(`Received channel create event for a guild channel in an unknown guild with ID ${channel.guild_id}.`);
								break;
							}
							const cachedChannel = createCachedChannel(channel, cachedGuild);
							cachedGuild.textChannels.set(channel.id, cachedChannel);
							// There's no need to sync the messages since there are no messages in a newly-created channel
						}

						await db.transaction(async () => {
							db.request({
								type: RequestType.AddChannelSnapshot,
								channel,
								timing: null,
							});
						});
						break;
					}

					case "CHANNEL_UPDATE": {
						const channel = payload.d;
						if (isChannelCacheable(channel)) {
							const cachedGuild = guilds.get(channel.guild_id);
							const cachedChannel = cachedGuild?.textChannels.get(channel.id);
							if (cachedGuild === undefined || cachedChannel === undefined) {
								log.warning?.(`Received channel update event for an unknown guild channel with ID ${channel.parent_id!}.`);
							} else {
								cachedChannel.name = channel.name!;

								const permissionOverwrites = new Map(channel.permission_overwrites?.map(o => [o.id, { allow: BigInt(o.allow), deny: BigInt(o.deny) }]));
								const didPermsChange = areMapsEqual(cachedChannel.permissionOverwrites, cachedChannel.permissionOverwrites, (a, b) => a.allow === b.allow && a.deny === b.deny);
								if (didPermsChange) {
									log.verbose?.(`Permissions for channel #${cachedChannel.name} (${cachedChannel.id}) changed.`);

									cachedChannel.permissionOverwrites = permissionOverwrites;
									updateGuildChannelPermissions(cachedChannel);
								}
							}
						}

						await db.transaction(async () => {
							db.request({
								type: RequestType.AddChannelSnapshot,
								channel,
								timing,
							});
						});
						break;
					}

					// It seems that, for user accounts, the READY event only contains joined active threads and this event is sent later with the non-joined but active threads.
					// This event is sent (containing all active threads) when the user gains access to a channel when and only if there are active threads in that channel.
					case "THREAD_LIST_SYNC": {
						if (allReady) {
							const cachedGuild = guilds.get(payload.d.guild_id);
							if (cachedGuild === undefined) {
								log.warning?.(`Received a thread list sync event for an unknown guild with ID ${payload.d.guild_id}.`);
							} else {
								for (const thread of payload.d.threads) {
									const cachedChannel = cachedGuild.textChannels.get(thread.parent_id);
									if (cachedChannel === undefined) {
										log.warning?.(`Received a thread list sync event for an unknown channel with ID ${thread.parent_id}.`);
									} else {
										sync: {
											for (const account of cachedGuild.accountData.keys()) {
												if (account.ongoingMessageSyncs.get(cachedChannel)?.has(thread.id)) {
													// The thread is already being synced. Skip it.
													break sync;
												}
											}
											const threadInfo = extractThreadInfo(thread, cachedChannel);
											syncMessages(getLeastRESTOccupiedAccount(cachedChannel.accountsWithReadPermission)!, threadInfo);
										}
									}
								}
							}
						}

						await db.transaction(async () => {
							for (const thread of payload.d.threads) {
								db.request({
									type: RequestType.AddChannelSnapshot,
									channel: thread,
									timing,
								});
							}
						});
						break;
					}

					case "CHANNEL_DELETE": {
						const channel = payload.d;
						if (isChannelCacheable(channel)) {
							const cachedGuild = guilds.get(channel.guild_id);
							const cachedChannelExisted = cachedGuild?.textChannels.has(channel.id);
							if (cachedGuild === undefined || cachedChannelExisted === undefined) {
								log.warning?.(`Received channel update event for an unknown guild channel with ID ${channel.id} from guild with ID ${channel.guild_id}.`);
							} else {
								cachedGuild.textChannels.delete(channel.id);
							}
						}

						await db.transaction(async () => {
							db.request({
								type: RequestType.MarkChannelAsDeleted,
								id: channel.id,
								timing,
							});
						});
						break;
					}

					case "MESSAGE_CREATE": {
						const message = payload.d;
						await db.transaction(async () => {
							db.request({
								type: RequestType.AddMessageSnapshot,
								message,
							});
						});
						break;
					}
					case "MESSAGE_UPDATE": {
						const message = payload.d;
						await db.transaction(async () => {
							db.request({
								type: RequestType.AddMessageSnapshot,
								message,
							});
						});
						break;
					}
					case "MESSAGE_DELETE": {
						await db.transaction(async () => {
							db.request({
								type: RequestType.MarkMessageAsDeleted,
								id: payload.d.id,
								timing,
							});
						});
						break;
					}

					case "MESSAGE_REACTION_ADD": {
						await db.transaction(async () => {
							db.request({
								type: RequestType.AddReactionPlacement,
								messageID: payload.d.message_id,
								emoji: payload.d.emoji,
								reactionType: payload.d.burst ? 1 : 0,
								userID: payload.d.user_id,
								timing,
							});
						});
						break;
					}
					case "MESSAGE_REACTION_REMOVE": {
						await db.transaction(async () => {
							db.request({
								type: RequestType.MarkReactionAsRemoved,
								messageID: payload.d.message_id,
								emoji: payload.d.emoji,
								reactionType: payload.d.burst ? 1 : 0,
								userID: payload.d.user_id,
								timing,
							});
						});
						break;
					}
					case "MESSAGE_REACTION_REMOVE_EMOJI":
					case "MESSAGE_REACTION_REMOVE_ALL":
					{
						await db.transaction(async () => {
							db.request({
								type: RequestType.MarkReactionsAsRemovedBulk,
								messageID: payload.d.message_id,
								emoji: payload.t === "MESSAGE_REACTION_REMOVE_EMOJI" ? payload.d.emoji : null,
								timing,
							});
						});
						break;
					}
					case "MESSAGE_REACTION_ADD_MANY": {
						// TODO for user account support
						log.warning?.("Received a MESSAGE_REACTION_ADD_MANY gateway event: %o", payload.d);
						break;
					}
				}
			} catch (err) {
				if (err !== abortError) {
					throw err;
				}
			} finally {
				account.ongoingDispatchHandlers.delete(operation);
				endOperation();
			}
		});

		gatewayConnection.on("sessionLost", () => {
			log.warning?.(`Gateway session lost for ${account.name}. Some events may have been missed so it's necessary to resync.`);
			// Handle interrupted member requests
			account.numberOfOngoingGatewayOperations -= account.ongoingMemberRequests.size;
			for (const guildID of account.ongoingMemberRequests) {
				account.ongoingMemberRequests.delete(guildID);

				const guild = guilds.get(guildID);
				if (guild !== undefined) {
					log.verbose?.(`Member request for guild ${guild.name} (${guildID}) was interrupted.`);
					guild.memberUserIDs = null;
				}
			}
		});

		if (log.debug) {
			gatewayConnection.on("payloadReceived", (payload: DT.GatewayReceivePayload) => {
				log.log(`<- ${account.name} %o`, payload);
			});
			gatewayConnection.on("payloadSent", (payload: DT.GatewaySendPayload) => {
				log.log(`-> ${account.name} %o`, payload);
			});
		}

		// TODO: Handle gateway errors
		gatewayConnection.on("error", (err) => {
			if (!ready) {
				rej(err);
			} else {
				throw err;
			}
		});

		const globalRateLimiter = new RateLimiter(49, 1000);
		async function request<T>(endpoint: string, options?: RequestInit, abortIfFail?: boolean): Promise<RequestResult<T>> {
			await globalRateLimiter.whenFree();
			const result = await apiReq<T>(endpoint, options, abortIfFail);
			if (result.response.status === 401) {
				log.error?.(`Got HTTP status 401 Unauthorized while using ${account.name}. The authentication token has been revoked. This account will be disconnected.`);
				// This will immediately abort all operations
				disconnectAccount(account);
				if (accounts.size === 0) {
					stop();
				}
			}
			return result;
		}

		const account: Account = {
			...accountOptions,
			bot,
			details: undefined,
			gatewayConnection,
			restOptions: {
				headers: {
					authorization: accountOptions.token,
				},
			},
			request,
			joinedGuilds: [],

			numberOfOngoingRESTOperations: 0,
			ongoingMessageSyncs: new Map(),
			ongoingPrivateThreadMessageSyncs: new Map(),

			ongoingPublicThreadListSyncs: new Map(),
			ongoingPrivateThreadListSyncs: new Map(),
			ongoingJoinedPrivateThreadListSyncs: new Map(),

			numberOfOngoingGatewayOperations: 0,
			ongoingMemberRequests: new Set(),

			ongoingDispatchHandlers: new Set(),

			references: new Set(),
		};
		accounts.add(account);
	});
}

async function disconnectAccount(account: Account) {
	account.gatewayConnection.destroy();
	accounts.delete(account);

	const endPromises = [];
	for (const set of account.ongoingMessageSyncs.values()) {
		for (const { abortController, end } of set.values()) {
			endPromises.push(end);
			abortController.abort();
		}
	}
	for (const set of account.ongoingPrivateThreadMessageSyncs.values()) {
		for (const { abortController, end } of set.values()) {
			endPromises.push(end);
			abortController.abort();
		}
	}
	for (const { abortController, end } of account.ongoingPublicThreadListSyncs.values()) {
		endPromises.push(end);
		abortController.abort();
	}
	for (const { abortController, end } of account.ongoingPrivateThreadListSyncs.values()) {
		endPromises.push(end);
		abortController.abort();
	}
	for (const { abortController, end } of account.ongoingJoinedPrivateThreadListSyncs.values()) {
		endPromises.push(end);
		abortController.abort();
	}
	for (const { abortController, end } of account.ongoingDispatchHandlers.values()) {
		endPromises.push(end);
		abortController.abort();
	}
	await Promise.all(endPromises);
}

// Cleanup
async function stop() {
	stopProgressDisplay();
	log.info?.("Exiting. (Press Ctrl+C again to terminate abruptly.)");
	globalAbortController.abort();
	await Promise.all(mapIterator(accounts.values(), account => disconnectAccount(account)));
	db.close();
	if (!options["no-files"]) {
		await closeFileStore(fileStorePath);
	}
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

if (!globalAbortSignal.aborted) {
	if (!options["no-files"]) {
		await openFileStore(fileStorePath, db);
	}

	// Connect to all accounts
	Promise.all(options.token.map((token, index) => connectAccount({
		name: `account #${index}`,
		mode: "bot",
		token,
		gatewayIdentifyData: {
			intents:
				DT.GatewayIntent.Guilds |
				DT.GatewayIntent.GuildMessages |
				DT.GatewayIntent.GuildMessageReactions |
				DT.GatewayIntent.DirectMessages |
				DT.GatewayIntent.DirectMessageReactions |
				DT.GatewayIntent.GuildMembers,
			properties: {
				os: process.platform,
				browser: "DiscordArchiver/0.0.0",
				device: "DiscordArchiver/0.0.0",
			},
			token,
		},
		restHeaders: {},
	}))).then(() => {
		allReady = true;
		log.info?.("All accounts are ready.");
		{
			let totalChannels = 0, accessibleChannels = 0;
			for (const guild of guilds.values()) {
				if (options.guild !== undefined && !options.guild.includes(guild.id)) continue;

				totalChannels += guild.textChannels.size;
				for (const channel of guild.textChannels.values()) {
					if (channel.accountsWithReadPermission.size > 0) {
						accessibleChannels++;
					}
				}
			}
			log.info?.(`\
	Statistics:
	${options.guild?.length ?? guilds.size} guilds
	${totalChannels} channels, out of which ${accessibleChannels} are accessible`);
		}

		if (!options["no-sync"]) {
			for (const guild of guilds.values()) {
				(async () => {
					if (options.guild !== undefined && !options.guild.includes(guild.id)) return;

					await guild.initialSyncPromise;

					syncAllGuildMembers(getLeastGatewayOccupiedAccount(guild.accountData.keys())!, guild);

					for (const channel of guild.textChannels.values() as IterableIterator<CachedChannelWithSyncInfo>) {
						if (channel.accountsWithReadPermission.size > 0) {
							syncMessages(getLeastRESTOccupiedAccount(channel.accountsWithReadPermission)!, channel);

							// Voice channels can't have threads
							if (channel.type !== DT.ChannelType.GuildVoice) {
								if (channel.accountsWithReadPermission.size > 0) {
									if (channel.accountsWithManageThreadsPermission.size > 0) {
										syncAllArchivedThreads(getLeastRESTOccupiedAccount(channel.accountsWithManageThreadsPermission)!, channel, ArchivedThreadListType.Private);
									}

									for (const thread of channel.syncInfo.activeThreads) {
										syncMessages(getLeastRESTOccupiedAccount(channel.accountsWithReadPermission)!, thread);
									}

									syncAllArchivedThreads(getLeastRESTOccupiedAccount(channel.accountsWithReadPermission)!, channel, ArchivedThreadListType.Public);
								}
							}
						}
						(channel as CachedChannel).syncInfo = null;
					}
				})();
			}
		}
	});
}
