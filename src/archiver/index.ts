import { setProgress } from "../util/progress-display.js";

process.on("uncaughtExceptionMonitor", () => {
	setProgress();
	console.error("ERROR: An unexpected error happened! Please report this.");
});

import * as DT from "../discord-api/types.js";
import { AddSnapshotResult, getDatabaseConnection, RequestType } from "../db/index.js";
import { GatewayConnection } from "../discord-api/gateway/connection.js";
import { apiReq, RequestResult } from "../discord-api/rest.js";
import { computeChannelPermissions, computeGuildPermissions } from "./permissions.js";
import { areMapsEqual } from "../util/map-equality.js";
import { abortError, waitForAbort } from "../util/abort.js";
import { parseArgs, ParseArgsConfig } from "node:util";
import log from "../util/log.js";
import { getTag } from "../discord-api/tag.js";
import { RateLimiter } from "../util/rate-limiter.js";
import { CachedTextLikeChannel, CachedGuild, createCachedChannel, createCachedThread, guilds, isGuildTextLikeChannel, CachedThread, CachedChannel, dmChannels as directChannels } from "./cache.js";
import { Account, AccountOptions, accounts, getLeastGatewayOccupiedAccount, getLeastRESTOccupiedAccount, OngoingOperation } from "./accounts.js";
import { ArchivedThreadSyncProgress, downloadProgresses, MessageSyncProgress, progressCounts, startProgressDisplay, stopProgressDisplay, updateProgressOutput } from "./progress.js";
import { DownloadArguments, getCDNEmojiURL, getCDNHashURL, getDownloadTransactionFunction, normalizeURL } from "./files.js";
import { mergeOptions } from "../util/http.js";
import { setMaxListeners } from "node:events";
import { FileStore } from "../db/file-store.js";
import { getGuildOptions, isFileStoreNeeded, MessageOptions, parseConfig, ParsedConfig } from "./config.js";
import { readFile } from "node:fs/promises";
import { ZodError } from "zod";
import { extractEmojis } from "../discord-api/message-content.js";

setMaxListeners(100);

await (async function main() {
	const parameters = {
		strict: true,
		allowPositionals: true,
		options: {
			log: {
				type: "string",
			},
			stats: {
				type: "string",
			},
			"sync-sqlite": {
				type: "boolean",
			},
			"file-store": {
				type: "string",
			},
			database: {
				type: "string",
				short: "d",
			},
			"config-file": {
				type: "string",
				short: "c",
			},
			config: {
				type: "string",
			},
		},
	} satisfies ParseArgsConfig;

	let args: ReturnType<typeof parseArgs<typeof parameters>>["values"];
	let json5Config: string;

	let stats: boolean;
	try {
		let positionals;
		({
			values: args,
			positionals,
		} = parseArgs(parameters));
		if (positionals.length !== 0 || args.database === undefined) {
			throw undefined;
		}
		log.setLevel(args.log ?? "info");
		switch (args.stats) {
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

		if (args.config !== undefined && args["config-file"] !== undefined) {
			// Both `config` and `config-file` specified
			throw undefined;
		} else if (args.config !== undefined) {
			json5Config = args.config;
		} else if (args["config-file"] !== undefined) {
			json5Config = await readFile(args["config-file"], "utf-8");
		} else {
			throw undefined;
		}
	} catch {
		console.error("\
Usage: node index.js (-d | --database) <database file path> ((-c | --config-file) <config file path> | --config <config>) [--log (error | warning | info | verbose | debug)] [--stats (yes | no | auto)] [--file-store <file store directory path>]");
		return;
	}

	let config: ParsedConfig;
	try {
		config = await parseConfig(json5Config);
	} catch (err) {
		if (!(err instanceof ZodError)) {
			throw err;
		}

		console.error(`Configuration error at ${err.errors[0].path.join(".")}: ${err.errors[0].message}`);
		return;
	}
	log.debug?.("Parsed config: %o", config);

	if (stats) {
		startProgressDisplay();
	}

	const globalAbortController = new AbortController();
	const globalAbortSignal = globalAbortController.signal;

	const dbOpenTimestamp = Date.now();
	const db = await getDatabaseConnection(args.database, args["sync-sqlite"] ?? false);
	db.ready.then(() => {
		log.verbose?.(`Successfully opened the database in ${Date.now()-dbOpenTimestamp} ms.`);
	});

	let fileStore: FileStore | undefined;
	if (isFileStoreNeeded(config)) {
		const fileStorePath = args["file-store"] ?? `${args.database}-files`;
		fileStore = new FileStore(fileStorePath, db, log);
		await fileStore.open();
	}
	const doDownloadTransaction = getDownloadTransactionFunction(db, fileStore);

	let allReady = false;


	// ARCHIVING

	// BUG: This doesn't extract the files of forwarded messages.
	function extractMessageFiles(message: DT.Message, options: MessageOptions): DownloadArguments[] {
		const emojis = extractEmojis(message.content);

		const files: DownloadArguments[] = [];
		if (options.downloadEmojisInMessages) {
			for (const emoji of emojis) {
				const url = getCDNEmojiURL(emoji, config.mediaConfig.usedEmoji, config.mediaConfig.animatedUsedEmoji);
				files.push({ url, downloadURL: url });
			}
		}
		if (options.downloadAttachments) {
			for (const attachment of message.attachments) {
				const normalizedURL = normalizeURL(attachment.url);
				files.push({ url: normalizedURL, downloadURL: attachment.url });
			}
		}
		for (const embed of message.embeds) {
			if (options.downloadEmbeddedImages) {
				if (embed.footer?.icon_url != undefined && embed.footer.proxy_icon_url != undefined) {
					files.push({ url: normalizeURL(embed.footer.icon_url), downloadURL: embed.footer.proxy_icon_url });
				}
				if (embed.image?.url != undefined && embed.image.proxy_url != undefined) {
					files.push({ url: normalizeURL(embed.image.url), downloadURL: embed.image.proxy_url });
				}
				if (embed.thumbnail?.url != undefined && embed.thumbnail.proxy_url != undefined) {
					files.push({ url: normalizeURL(embed.thumbnail.url), downloadURL: embed.thumbnail.proxy_url });
				}
				if (embed.author?.icon_url != undefined && embed.author.proxy_icon_url != undefined) {
					files.push({ url: normalizeURL(embed.author.icon_url), downloadURL: embed.author.proxy_icon_url });
				}
			}
			if (options.downloadEmbeddedVideos) {
				if (embed.video?.url != undefined && embed.video.proxy_url != undefined) {
					files.push({ url: normalizeURL(embed.video.url), downloadURL: embed.video.proxy_url });
				}
			}
		}
		if (message.author.avatar != null && options.downloadAuthorAvatars) {
			const avatarURL = getCDNHashURL(`/avatars/${message.author.id}`, message.author.avatar, config.mediaConfig.avatar, config.mediaConfig.animatedAvatar);
			files.push({ url: avatarURL, downloadURL: avatarURL });
		}
		return files;
	}

	async function archiveMessageSnapshot(
		account: Account,
		message: DT.Message,
		cachedChannel: CachedTextLikeChannel | CachedThread,
		timestamp: number,
		abortSignal: AbortSignal,
		includeReactions: boolean,
		files = extractMessageFiles(message, cachedChannel.options),
	) {
		const restOptions = mergeOptions(account.restOptions, { signal: abortSignal });

		const reactions: {
			emoji: DT.PartialEmoji;
			reactionType: 0 | 1;
			userIDs: string[];
		}[] = [];

		if (includeReactions && cachedChannel.options.reactionArchivalMode === "users" && message.reactions != null) {
			for (const reaction of message.reactions) {
				for (const [reactionType, expectedCount] of [
					...(reaction.count_details.normal > 0 ? [[0, reaction.count_details.normal]] : []),
					...(reaction.count_details.burst > 0 ? [[1, reaction.count_details.burst]] : []),
				] as [0 | 1, number][]) {
					if (cachedChannel.options.downloadEmojisInReactions && reaction.emoji.id !== null) {
						const url = getCDNEmojiURL(reaction.emoji, config.mediaConfig.usedEmoji, config.mediaConfig.animatedUsedEmoji);
						files.push({ url, downloadURL: url });
					}

					const reactionData = {
						emoji: reaction.emoji,
						reactionType,
						userIDs: new Array<string>(expectedCount),
					};
					let i = 0;
					const emoji = reaction.emoji.id === null ? reaction.emoji.name : `${reaction.emoji.name}:${reaction.emoji.id}`;

					let userID = "0";
					let rateLimitReset;
					while (true) {
						await rateLimitReset;
						let response, data: DT.PartialUser[] | undefined;
						({ response, data, rateLimitReset } = await account.request<DT.PartialUser[]>(`/channels/${cachedChannel.id}/messages/${message.id}/reactions/${emoji}?limit=100&type=${reactionType}&after=${userID}`, restOptions, true));
						if (abortSignal.aborted) throw abortError;
						if (!response.ok) {
							throw new Error(`Got HTTP ${response.status} ${response.statusText} while requesting reactions for the message with ID ${message.id} from #${cachedChannel.name}`);
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
						log.verbose?.(`The reaction count (${expectedCount}) is different from the length of the list (${i}) of users who reacted to the message with ID ${message.id} from #${cachedChannel.name} (${cachedChannel.id}).`);
					}
				}
			}
		}

		let messageAddPromise: Promise<AddSnapshotResult>;
		await doDownloadTransaction(abortSignal, files, async () => {
			messageAddPromise = db.request({
				type: RequestType.AddMessageSnapshot,
				timestamp,
				message: message,
			});
			for (const reactionData of reactions) {
				db.request({
					type: RequestType.AddInitialReactions,
					messageID: message.id,
					emoji: reactionData.emoji,
					reactionType: reactionData.reactionType,
					userIDs: reactionData.userIDs,
				});
			}
		});
		return await messageAddPromise!;
	}

	// SYNCING

	// TODO: This can be optimized. We don't need to wait for all reactions/files from the previous
	// message to be downloaded to start downloading the ones from the next message.
	async function syncMessages(account: Account, channel: CachedTextLikeChannel | CachedThread): Promise<void> {
		const options = channel.options;
		if (!(options.archiveMessages && options.requestPastMessages)) return;

		const lastMessageID = channel.lastMessageID;
		channel.lastMessageID = null;
		const parentChannel = channel.parent ?? channel;

		const abortController = new AbortController();
		const restOptions = mergeOptions(account.restOptions, { signal: abortController.signal });

		// Add this operation to the ongoing syncs list
		const { promise: end, resolve: endOperation } = Promise.withResolvers<void>();
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

		let progress: MessageSyncProgress | undefined;

		try {
			// Check if it is necessary to sync this channel based on last_message_id and the id of the last stored message
			// TODO: Don't check this when switching accounts
			const lastStoredMessageID = await db.request({ type: RequestType.GetLastMessageID, channelID: channel.id });
			if (!(lastMessageID == null || lastStoredMessageID == null || lastStoredMessageID < BigInt(lastMessageID))) {
				return;
			}
			log.verbose?.(`${lastStoredMessageID == null ? "Started" : "Resumed"} syncing messages from #${channel.name} (${channel.id})${lastStoredMessageID == null ? "" : ` after message ${lastStoredMessageID}`} using ${account.name}.`);

			progressCounts.messageSyncs++;
			progress = {
				channel,
				progress: 0,
			};
			downloadProgresses.add(progress);
			updateProgressOutput();

			const lastMessageIDNum = lastMessageID != null ? Number.parseInt(lastMessageID) : null;
			let firstMessageIDNum: number | undefined;

			let messageID = lastStoredMessageID?.toString() ?? "0";

			function updateProgress(currentID: string, count: number) {
				progress!.progress = lastMessageIDNum === null ? null : (Number.parseInt(currentID) - firstMessageIDNum!) / (lastMessageIDNum - firstMessageIDNum!);
				progressCounts.messagesArchived += count;
				updateProgressOutput();
			}

			main:
			while (true) {
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

				const timestamp = Date.now();
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
									timestamp,
									message: messages[j],
								});
							}
						});
					}

					for (i = messages.length - 1; i >= 0; i--) {
						const message = messages[i];

						const files = extractMessageFiles(message, options);

						if (
							(options.reactionArchivalMode === "users" && message.reactions !== undefined && message.reactions.length !== 0) ||
							files.length > 0
						) {
							flushSimpleMessages();
							simpleMessagesStartIndex = i - 1;

							try {
								await archiveMessageSnapshot(account, message, channel, timestamp, abortController.signal, true, files);
							} catch (err) {
								if (err === abortError) throw err;
								log.warning?.(`Stopped syncing messages from #${channel.name} (${channel.id}) using ${account.name} because we got a ${response.status} ${response.statusText} response.`);
								break main;
							}

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
			}
		} catch (err) {
			if (err === abortError) {
				log.verbose?.(`Stopped syncing messages from #${channel.name} (${channel.id}) using ${account.name}.`);
			} else {
				log.error?.("Unexpected error while syncing messages.");
				throw err;
			}
		} finally {
			if (progress !== undefined) {
				progressCounts.messageSyncs--;
				downloadProgresses.delete(progress);
			}
			updateProgressOutput();

			// Remove this operation from the ongoing syncs list
			if (ongoingChannelSyncs.size > 1) {
				ongoingChannelSyncs.delete(channel.id);
			} else {
				ongoingSyncs.delete(parentChannel);
			}
			account.numberOfOngoingRESTOperations--;
			endOperation();
		}
	}

	// TODO: This assumes that the thread enumeration is not interrupted
	enum ArchivedThreadListType {
		Public,
		Private,
		JoinedPrivate,
	}
	async function syncAllArchivedThreads(account: Account, channel: CachedTextLikeChannel, type: ArchivedThreadListType) {
		if (!(channel.options.archiveThreads && channel.options.requestArchivedThreads)) return;

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

		const { promise: end, resolve: endOperation } = Promise.withResolvers<void>();
		const ongoingMap =
			type === ArchivedThreadListType.Public ? account.ongoingPublicThreadListSyncs :
			type === ArchivedThreadListType.Private ? account.ongoingPrivateThreadListSyncs :
			account.ongoingJoinedPrivateThreadListSyncs;
		ongoingMap.set(channel, { abortController, end });
		account.numberOfOngoingRESTOperations++;

		let oldestThreadArchivedTimestamp = "";
		while (true) {
			try {
				const { response, data, rateLimitReset } = await account.request<DT.ListThreadsResponse>(
					type === ArchivedThreadListType.Public ? `/channels/${channel.id}/threads/archived/public?limit=100&before=${encodeURIComponent(oldestThreadArchivedTimestamp)}` :
					type === ArchivedThreadListType.Private ? `/channels/${channel.id}/threads/archived/private?limit=100&before=${encodeURIComponent(oldestThreadArchivedTimestamp)}` :
					`/channels/${channel.id}/users/@me/threads/archived/private?limit=100&before=${encodeURIComponent(oldestThreadArchivedTimestamp)}`,
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
								type: RequestType.AddThreadSnapshot,
								thread: list.threads[i],
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
						syncMessages(getLeastRESTOccupiedAccount(channel.accountsWithReadPermission)!, createCachedThread(thread, config, channel));
					}

					oldestThreadArchivedTimestamp = list.threads.at(-1)!.thread_metadata.archive_timestamp;
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
				} else {
					log.error?.("Unexpected error while syncing archived threads.");
					throw err;
				}
			}
		}

		ongoingMap.delete(channel);
		account.numberOfOngoingRESTOperations--;
		endOperation();

		progressCounts.threadEnumerations--;
		downloadProgresses.delete(progress);
		updateProgressOutput();
	}

	async function requestExpressionUploaders(account: Account, cachedGuild: CachedGuild) {
		const abortController = new AbortController();
		const restOptions = mergeOptions(account.restOptions, { signal: abortController.signal });

		const { promise: end, resolve: endOperation } = Promise.withResolvers<void>();
		const operation: OngoingOperation = {
			abortController,
			end,
		};
		account.ongoingExpressionUploaderRequests.add(operation);
		account.numberOfOngoingRESTOperations++;

		try {
			log.verbose?.(`Requesting the uploaders of emojis from ${cachedGuild.name} (${cachedGuild.id}) using ${account.name}.`);
			const { response, data } = await account.request<DT.CustomEmoji[]>(`/guilds/${cachedGuild.id}/emojis`, restOptions, true);
			if (!response.ok) {
				log.warning?.(`Got ${response.status} ${response.statusText} response while requesting the uploaders of emojis from ${cachedGuild.name} (${cachedGuild.id}) using ${account.name}.`);
				return;
			}
			const timestamp = Date.now();
			const emojisWithUploader = data!.filter((e => e.user != null) as (e: DT.CustomEmoji) => e is (DT.CustomEmoji & { user: DT.PartialUser }));
			db.transaction(async () => {
				const userIDs = new Set();
				for (const emoji of emojisWithUploader) {
					if (!userIDs.has(emoji.user.id)) {
						userIDs.add(emoji.user.id);
						db.request({
							type: RequestType.AddUserSnapshot,
							user: emoji.user,
							timing: {
								timestamp,
								realtime: false,
							},
						});
					}
				}
				db.request({
					type: RequestType.UpdateEmojiUploaders,
					emojis: emojisWithUploader
						.map(emoji => ({ id: emoji.id, user__id: emoji.user.id })),
				});
			});
		} catch (err) {
			if (err !== abortError) {
				log.error?.("Unexpected error while requesting expression uploaders.");
				throw err;
			}
		} finally {
			account.ongoingExpressionUploaderRequests.delete(operation);
			account.numberOfOngoingRESTOperations--;
			endOperation();
		}
	}


	// GATEWAY

	function updateGuildPermissions(guild: CachedGuild) {
		for (const [account, accountData] of guild.accountData) {
			accountData.guildPermissions = computeGuildPermissions(account, guild, accountData.roles);

			const expressionPermissions = account.bot ?
				DT.Permission.ManageGuildExpressions :
				(DT.Permission.CreateGuildExpressions | DT.Permission.ManageGuildExpressions);
			const hasEmojiPermission = (accountData.guildPermissions & expressionPermissions) != 0n;
			if (hasEmojiPermission) {
				guild.accountsWithExpressionPermission.add(account);
				account.references.add(guild.accountsWithExpressionPermission);
			} else if (guild.accountsWithExpressionPermission.has(account)) {
				guild.accountsWithExpressionPermission.delete(account);
				account.references.delete(guild.accountsWithExpressionPermission);
			}
		}
		for (const cachedChannel of guild.channels.values()) {
			if (cachedChannel.textLike) {
				updateGuildChannelPermissions(cachedChannel);
			}
		}
	}

	/**
	 * Updates the account sets in the cached channel object and aborts syncs for accounts which lost
	 * permission.
	 */
	function updateGuildChannelPermissions(cachedChannel: CachedTextLikeChannel) {
		const accountWithReadPermExisted = cachedChannel.accountsWithReadPermission.size > 0;
		const accountWithManagePermExisted = cachedChannel.accountsWithManageThreadsPermission.size > 0;
		const accountsThatLostReadPermission = new Set<Account>();
		const accountsThatLostManageThreadsPermission = new Set<Account>();

		for (const [account, accountData] of cachedChannel.guild!.accountData.entries()) {
			const permissions = computeChannelPermissions(account, cachedChannel.guild!, cachedChannel, accountData);
			const implicitlyDenied =
				(permissions & DT.Permission.ViewChannel) === 0n ||
				(
					(
						cachedChannel.type === DT.ChannelType.GuildVoice ||
						cachedChannel.type === DT.ChannelType.GuildStageVoice
					) &&
					(permissions & DT.Permission.Connect) === 0n
				);
			const hasReadPermission = !implicitlyDenied && (permissions & DT.Permission.ReadMessageHistory) !== 0n;
			const hasManageThreadsPermission = !implicitlyDenied && (permissions & DT.Permission.ManageThreads) !== 0n;

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

		if (cachedChannel.options.archiveMessages && cachedChannel.options.requestPastMessages) {
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
					log.error?.("The archiver was supposed to switch a thread enumeration process to another account due to losing permissions but this is currently unimplemented. Restart the archiver.");
				}
				for (const sync of account.ongoingPrivateThreadMessageSyncs.get(cachedChannel)?.values() ?? []) {
					sync.abortController.abort();
					const newAccount = getLeastRESTOccupiedAccount(cachedChannel.accountsWithManageThreadsPermission);
					if (newAccount !== undefined) {
						syncMessages(newAccount, sync.channel);
					}
				}
			}
		}

		if (cachedChannel.hasThreads && allReady) {
			// Active threads are synced when we receive the THREAD_LIST_SYNC dispatch event.
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

	function syncAllGuildMembers(account: Account, cachedGuild: CachedGuild) {
		if (!cachedGuild.options.requestAllMembers) return;
		log.verbose?.(`Requesting all guild members from ${cachedGuild.name} (${cachedGuild.id}) using ${account.name}.`);
		cachedGuild.memberUserIDs = new Set();
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
			function onReceivedGuildInfo() {
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

			function getGuild(guildID: string, eventType: DT.DispatchEventName): CachedGuild | undefined {
				const cachedGuild = guilds.get(guildID);
				if (cachedGuild === undefined) {
					log.warning?.(`Received a ${eventType} dispatch for an unknown guild with ID ${guildID}.`);
					return undefined;
				}
				return cachedGuild;
			}
			function getGuildChannel(channelID: string, guildID: string, eventType: DT.DispatchEventName, includeThreads?: false): CachedChannel | undefined;
			function getGuildChannel(channelID: string, guildID: string, eventType: DT.DispatchEventName, includeThreads?: boolean): CachedChannel | CachedThread | undefined;
			function getGuildChannel(channelID: string, guildID: string, eventType: DT.DispatchEventName, includeThreads = false): CachedChannel | CachedThread | undefined {
				const cachedGuild = guilds.get(guildID);
				if (cachedGuild === undefined) {
					log.warning?.(`Received a ${eventType} dispatch for a guild channel with ID ${channelID} from an unknown guild with ID ${guildID}.`);
					return undefined;
				}
				const cachedChannel = cachedGuild.channels.get(channelID);
				if (cachedChannel !== undefined) return cachedChannel;
				if (!includeThreads) {
					log.warning?.(`Received a ${eventType} dispatch for an unknown guild channel with ID ${channelID} from the guild with ID ${guildID}.`);
					return undefined;
				}
				const cachedThread = cachedGuild.activeThreads.get(channelID);
				if (cachedThread === undefined) {
					log.warning?.(`Received a ${eventType} dispatch for an unknown guild channel or thread with ID ${channelID} from the guild with ID ${guildID}.`);
					return undefined;
				}
				return cachedThread;
			}
			function getDirectChannel(channelID: string, eventType: DT.DispatchEventName): CachedChannel | undefined {
				const cachedChannel = directChannels.get(channelID);
				if (cachedChannel === undefined) {
					log.warning?.(`Received a ${eventType} dispatch for an unknown direct channel with ID ${channelID}.`);
					return undefined;
				}
				return cachedChannel;
			}
			function getChannelOrThreadByIDs(channelID: string, guildID: string | undefined, eventType: DT.DispatchEventName) {
				if (guildID !== undefined) {
					return getGuildChannel(channelID, guildID, eventType, true);
				} else {
					return getDirectChannel(channelID, eventType);
				}
			}
			function getChannel(channel: DT.GatewayChannelDispatchChannel, eventType: DT.DispatchEventName): CachedChannel | undefined {
				if (DT.isGuildChannel(channel)) {
					return getGuildChannel(channel.id, channel.guild_id, eventType);
				} else if (DT.isDirectChannel(channel)) {
					return getDirectChannel(channel.id, eventType);
				} else {
					const unknownChannel: any = channel satisfies never;
					log.warning?.(`Received a ${eventType} event for a channel with ID ${unknownChannel.id} with an unknown type ${unknownChannel.type}.`);
					return undefined;
				}
			}

			gatewayConnection.addListener("dispatch", async (payload: DT.GatewayDispatchPayload, realtime: boolean) => {
				const timestamp = Date.now();
				const timing = {
					timestamp,
					realtime,
				};

				const abortController = new AbortController();
				const { promise: end, resolve: endOperation } = Promise.withResolvers<void>();
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
								onReceivedGuildInfo();
							}
							break;
						}

						case "GUILD_CREATE": {
							onReceivedGuildInfo();
							let cachedGuild: CachedGuild;
							const guild = payload.d;
							const rolePermissions = new Map(guild.roles.map(r => [r.id, BigInt(r.permissions)]));
							const ownMember = guild.members.find(m => m.user.id === account.details!.id)!;

							const options = getGuildOptions(config, guild.id);

							const alreadyCached = guilds.has(guild.id);
							if (!alreadyCached) {
								let initialSyncPromise: Promise<Pick<CachedGuild, "missingEmojiUploaders"> | undefined>;
								if (options.archive) {
									const files: DownloadArguments[] = [];
									if (options.downloadServerAssets) {
										if (guild.icon != null) {
											const url = getCDNHashURL(`/icons/${guild.id}`, guild.icon, config.mediaConfig.serverIcon, config.mediaConfig.animatedServerIcon);
											files.push({ url, downloadURL: url });
										}
										if (guild.splash != null) {
											const url = getCDNHashURL(`/splashes/${guild.id}`, guild.splash, config.mediaConfig.serverSplash);
											files.push({ url, downloadURL: url });
										}
										if (guild.discovery_splash != null) {
											const url = getCDNHashURL(`/discovery-splashes/${guild.id}`, guild.discovery_splash, config.mediaConfig.serverDiscoverySplash);
											files.push({ url, downloadURL: url });
										}
										if (guild.banner != null) {
											const url = getCDNHashURL(`/banners/${guild.id}`, guild.banner, config.mediaConfig.serverBanner, config.mediaConfig.animatedServerBanner);
											files.push({ url, downloadURL: url });
										}
									}
									if (options.downloadExpressions) {
										for (const emoji of guild.emojis) {
											const url = getCDNEmojiURL(emoji, config.mediaConfig.serverEmoji, config.mediaConfig.animatedServerEmoji);
											files.push({ url, downloadURL: url });
										}
									}


									// Will be awaited below.
									initialSyncPromise = doDownloadTransaction(abortController.signal, files, async () => {
										const guildSnapshotTiming = {
											timestamp,
											realtime: false,
										};

										db.request({
											type: RequestType.SyncDeletedGuildSubObjects,
											guildID: BigInt(guild.id),
											channelIDs: new Set(guild.channels.map(c => BigInt(c.id))),
											roleIDs: new Set(guild.roles.map(r => BigInt(r.id))),
											emojiIDs: new Set(guild.emojis.map(e => BigInt(e.id))),
											timing: guildSnapshotTiming,
										});

										db.request({
											type: RequestType.AddGuildSnapshot,
											guild,
											timing: guildSnapshotTiming,
										});

										for (const emoji of guild.emojis) {
											db.request({
												type: RequestType.AddGuildEmojiSnapshot,
												emoji,
												guildID: guild.id,
												timing: guildSnapshotTiming,
											});
										}
										const ret = Promise.all([
											db.request({
												type: RequestType.CheckForMissingEmojiUploaders,
												guildID: guild.id,
											}),
										]);

										for (const role of guild.roles) {
											db.request({
												type: RequestType.AddRoleSnapshot,
												role,
												guildID: guild.id,
												timing: guildSnapshotTiming,
											});
										}

										for (const channel of guild.channels) {
											db.request({
												type: RequestType.AddChannelSnapshot,
												channel: Object.assign(channel, { guild_id: guild.id }),
												timing: guildSnapshotTiming,
											});
										}

										for (const thread of guild.threads) {
											db.request({
												type: RequestType.AddThreadSnapshot,
												thread: Object.assign(thread, { guild_id: guild.id }),
												timing: guildSnapshotTiming,
											});
										}

										const [
											missingEmojiUploaders,
										] = await ret;
										return {
											missingEmojiUploaders,
										};
									});
								} else {
									// This guild won't be archived
									initialSyncPromise = Promise.resolve(undefined);
								}

								cachedGuild = {
									id: guild.id,
									options,
									name: guild.name,
									ownerID: guild.owner_id,
									rolePermissions,
									accountData: new Map(),
									accountsWithExpressionPermission: new Set(),
									channels: new Map(),
									activeThreads: new Map(),
									memberUserIDs: null,
									missingEmojiUploaders: undefined,
									initialSyncPromise: initialSyncPromise.then(() => undefined),
								};
								// Prevent this promise from causing an unhandled rejection while
								// propagating the error to awaiting consumers. Any error in this promise
								// will also be encountered by the `await` expression below.
								cachedGuild.initialSyncPromise.catch(() => {});
								cachedGuild.channels = new Map(
									payload.d.channels.map(c => [c.id, createCachedChannel(c, config, cachedGuild)]),
								);
								guilds.set(guild.id, cachedGuild);
								for (const thread of guild.threads) {
									const parent = cachedGuild.channels.get(thread.parent_id) as CachedTextLikeChannel;
									cachedGuild.activeThreads.set(thread.id, createCachedThread(thread, config, parent));
								}

								cachedGuild.accountData.set(account, {
									roles: new Set(ownMember.roles),
									guildPermissions: 0n, // will be computed below
								});
								updateGuildPermissions(cachedGuild);

								updateProgressOutput();

								const syncResult = await initialSyncPromise;
								cachedGuild.missingEmojiUploaders = syncResult?.missingEmojiUploaders;
								log.verbose?.(`${options.archive ? "Synced" : "Received"} basic guild info for ${cachedGuild.name} (${cachedGuild.id}) using ${account.name}.`);
							}

							// TODO: Sync when a new guild appears. This should happen after awaiting the initial sync.

							break;
						}
						case "GUILD_UPDATE": {
							// BUG: This assumes that no permission changes are caused by this event. This could happen if the owner changed.
							const cachedGuild = getGuild(payload.d.id, payload.t);
							if (cachedGuild === undefined) break;
							if (cachedGuild.options.storeServerEdits) {
								await cachedGuild.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddGuildSnapshot,
										guild: payload.d,
										timing,
									});
								});
							}
							break;
						}

						case "GUILD_ROLE_CREATE":
						case "GUILD_ROLE_UPDATE":
						{
							const cachedGuild = getGuild(payload.d.guild_id, payload.t);
							if (cachedGuild === undefined) break;

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

							if (cachedGuild.options.storeServerEdits) {
								await cachedGuild.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddRoleSnapshot,
										role: payload.d.role,
										guildID: payload.d.guild_id,
										timing,
									});
								});
							}
							break;
						}
						case "GUILD_ROLE_DELETE": {
							const cachedGuild = getGuild(payload.d.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							if (cachedGuild.rolePermissions.has(payload.d.role_id)) {
								log.verbose?.(`Role with ID ${payload.d.role_id} from guild ${cachedGuild.name} (${payload.d.guild_id}) was deleted.`);
								cachedGuild.rolePermissions.delete(payload.d.role_id);
								updateGuildPermissions(cachedGuild);
							}

							if (cachedGuild.options.storeServerEdits) {
								await cachedGuild.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.MarkRoleAsDeleted,
										id: payload.d.role_id,
										timing,
									});
								});
							}
							break;
						}

						case "GUILD_EMOJIS_UPDATE": {
							const cachedGuild = getGuild(payload.d.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							if (cachedGuild.options.storeServerEdits) {
								await db.transaction(async () => {
									db.request({
										type: RequestType.SyncDeletedGuildSubObjects,
										guildID: BigInt(payload.d.guild_id),
										emojiIDs: new Set(payload.d.emojis.map(e => BigInt(e.id))),
										timing,
									});
									for (const emoji of payload.d.emojis) {
										db.request({
											type: RequestType.AddGuildEmojiSnapshot,
											emoji,
											guildID: payload.d.guild_id,
											timing,
										});
									}
								});
							}
							break;
						}

						case "GUILD_MEMBERS_CHUNK": {
							const isLast = payload.d.chunk_index === payload.d.chunk_count - 1;
							const cachedGuild = getGuild(payload.d.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							if (cachedGuild.memberUserIDs === null) {
								log.warning?.("Received an unexpected GUILD_MEMBERS_CHUNK dispatch.");
								break;
							}
							for (const member of payload.d.members) {
								cachedGuild.memberUserIDs.add(BigInt(member.user.id));
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

							const files: DownloadArguments[] = [];
							if (cachedGuild.options.downloadAllMemberAvatars) {
								for (const { user } of payload.d.members) {
									if (user.avatar != null) {
										const iconURL = getCDNHashURL(`/avatars/${user.id}`, user.avatar, config.mediaConfig.avatar, config.mediaConfig.animatedAvatar);
										files.push({ url: iconURL, downloadURL: iconURL });
									}
								}
							}

							if (isLast) {
								account.ongoingMemberRequests.delete(payload.d.guild_id);
								account.numberOfOngoingGatewayOperations--;
							}

							if (cachedGuild.options.storeServerEdits) {
								await cachedGuild.initialSyncPromise;
								await doDownloadTransaction(abortController.signal, files, async () => {
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
							}
							break;
						}

						case "GUILD_MEMBER_ADD": {
							const member = payload.d;
							const cachedGuild = getGuild(member.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							if (cachedGuild.options.storeMemberEvents) {
								await cachedGuild.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddMemberSnapshot,
										partial: false,
										member,
										guildID: member.guild_id,
										userID: member.user.id,
										timing,
									});
								});
							}
							break;
						}
						case "GUILD_MEMBER_UPDATE": {
							const member = payload.d;
							const cachedGuild = getGuild(member.guild_id, payload.t);
							if (cachedGuild === undefined) break;

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

							// It seems like the API always returns a full member, but it's better to check.
							// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
							if (member.joined_at == null) {
								log.warning?.("`joined_at` is missing on a guild member update event. This snapshot won't be recorded.");
							} else if (cachedGuild.options.storeMemberEvents) {
								await cachedGuild.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddMemberSnapshot,
										partial: false,
										member,
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
							const cachedGuild = getGuild(member.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							if (cachedGuild.options.storeMemberEvents) {
								await cachedGuild.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddMemberLeave,
										guildID: member.guild_id,
										userID: member.user.id,
										timing,
									});
								});
							}
							break;
						}

						case "CHANNEL_CREATE": {
							const channel = payload.d;
							let cachedGuild: CachedGuild | undefined;
							if (DT.isGuildChannel(channel)) {
								cachedGuild = getGuild(channel.guild_id, payload.t);
								if (cachedGuild === undefined) break;
							} else if (!DT.isDirectChannel(channel)) {
								const unknownChannel: any = channel satisfies never;
								log.warning?.(`Received a CHANNEL_CREATE event for a channel with ID ${unknownChannel.id} with an unknown type ${unknownChannel.type}.`);
							}
							const cachedChannel = createCachedChannel(channel, config, cachedGuild);
							if (cachedGuild !== undefined) {
								cachedGuild.channels.set(channel.id, cachedChannel);
							}

							// There's no need to sync the messages since there are no messages in a newly-created channel

							if (cachedChannel.options.storeNewChannels) {
								await cachedGuild?.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddChannelSnapshot,
										channel,
										timing: null,
									});
								});
							}
							break;
						}

						case "CHANNEL_UPDATE": {
							const cachedChannel = getChannel(payload.d, payload.t);
							if (cachedChannel === undefined) break;
							const channel = payload.d;

							if (isGuildTextLikeChannel(channel)) {
								const cachedGTLChannel = cachedChannel as CachedTextLikeChannel;
								cachedGTLChannel.name = channel.name!;

								const permissionOverwrites = new Map(channel.permission_overwrites?.map(o => [o.id, { allow: BigInt(o.allow), deny: BigInt(o.deny) }]));
								const didPermsChange = areMapsEqual(cachedGTLChannel.permissionOverwrites, cachedGTLChannel.permissionOverwrites, (a, b) => a.allow === b.allow && a.deny === b.deny);
								if (didPermsChange) {
									log.verbose?.(`Permissions for channel #${cachedGTLChannel.name} (${cachedGTLChannel.id}) changed.`);

									cachedGTLChannel.permissionOverwrites = permissionOverwrites;
									updateGuildChannelPermissions(cachedGTLChannel);
								}
							}

							if (cachedChannel.options.storeChannelEdits) {
								await cachedChannel.guild?.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddChannelSnapshot,
										channel,
										timing,
									});
								});
							}
							break;
						}

						// It seems that, for user accounts, the READY event only contains joined active threads and this event is sent later with the non-joined but active threads.
						// This event is sent (containing all active threads) when the user gains access to a channel if and only if there are active threads in that channel.
						case "THREAD_LIST_SYNC": {
							const threadsToArchive: DT.Thread[] = [];

							const cachedGuild = getGuild(payload.d.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							for (const thread of payload.d.threads) {
								const cachedChannel = cachedGuild.channels.get(thread.parent_id) as CachedTextLikeChannel | undefined;
								if (cachedChannel === undefined) {
									log.warning?.(`Received a THREAD_LIST_SYNC event for an unknown channel with ID ${thread.parent_id}.`);
									break;
								}

								const threadInfo = createCachedThread(thread, config, cachedChannel);

								if (threadInfo.options.archiveThreads) {
									threadsToArchive.push(thread);
								}
								cachedGuild.activeThreads.set(threadInfo.id, threadInfo);

								sync:
								if (allReady && threadInfo.options.archiveThreads && threadInfo.options.archiveMessages && threadInfo.options.requestPastMessages) {
									for (const account of cachedGuild.accountData.keys()) {
										if (account.ongoingMessageSyncs.get(cachedChannel)?.has(thread.id)) {
											// The thread is already being synced. Ignore it.
											break sync;
										}
									}
									syncMessages(getLeastRESTOccupiedAccount(cachedChannel.accountsWithReadPermission)!, threadInfo);
								}
							}

							await cachedGuild.initialSyncPromise;
							await db.transaction(async () => {
								for (const thread of threadsToArchive) {
									db.request({
										type: RequestType.AddThreadSnapshot,
										thread,
										timing,
									});
								}
							});
							break;
						}

						case "CHANNEL_DELETE": {
							const channel = payload.d;
							const cachedChannel = getChannel(channel, payload.t);
							if (cachedChannel === undefined) break;

							if (cachedChannel.options.storeChannelEdits) {
								await cachedChannel.guild?.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.MarkChannelAsDeleted,
										id: channel.id,
										timing,
									});
								});
							}
							break;
						}

						case "MESSAGE_CREATE":
						case "MESSAGE_UPDATE":
						{
							const cachedChannel = getChannelOrThreadByIDs(payload.d.channel_id, payload.d.guild_id, payload.t);
							if (cachedChannel === undefined) break;

							if (
								payload.t === "MESSAGE_CREATE" ?
									cachedChannel.options.storeNewMessages :
									cachedChannel.options.storeMessageEdits
							) {
								// It's necessary to await the initial sync because it's possible to
								// receive a MESSAGE_CREATE event after the GUILD_CREATE or READY
								// event but before the guild's data is in the database.
								await cachedChannel.guild?.initialSyncPromise;
								await archiveMessageSnapshot(account, payload.d, cachedChannel as CachedTextLikeChannel, timestamp, abortController.signal, false);
							}
							break;
						}
						case "MESSAGE_DELETE": {
							const cachedChannel = getChannelOrThreadByIDs(payload.d.channel_id, payload.d.guild_id, payload.t);
							if (cachedChannel === undefined) break;

							if (cachedChannel.options.storeMessageEdits) {
								await db.transaction(async () => {
									db.request({
										type: RequestType.MarkMessageAsDeleted,
										id: payload.d.id,
										timing,
									});
								});
							}
							break;
						}

						case "MESSAGE_REACTION_ADD": {
							const cachedChannel = getChannelOrThreadByIDs(payload.d.channel_id, payload.d.guild_id, payload.t);
							if (cachedChannel === undefined) break;

							if (cachedChannel.options.reactionArchivalMode === "users" && cachedChannel.options.storeReactionEvents) {
								await cachedChannel.guild?.initialSyncPromise;
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
							}
							break;
						}
						case "MESSAGE_REACTION_REMOVE": {
							const cachedChannel = getChannelOrThreadByIDs(payload.d.channel_id, payload.d.guild_id, payload.t);
							if (cachedChannel === undefined) break;

							if (cachedChannel.options.reactionArchivalMode === "users" && cachedChannel.options.storeReactionEvents) {
								await cachedChannel.guild?.initialSyncPromise;
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
							}
							break;
						}
						case "MESSAGE_REACTION_REMOVE_EMOJI":
						case "MESSAGE_REACTION_REMOVE_ALL":
						{
							const cachedChannel = getChannelOrThreadByIDs(payload.d.channel_id, payload.d.guild_id, payload.t);
							if (cachedChannel === undefined) break;

							if (cachedChannel.options.reactionArchivalMode === "users" && cachedChannel.options.storeReactionEvents) {
								await cachedChannel.guild?.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.MarkReactionsAsRemovedBulk,
										messageID: payload.d.message_id,
										emoji: payload.t === "MESSAGE_REACTION_REMOVE_EMOJI" ? payload.d.emoji : null,
										timing,
									});
								});
							}
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

			gatewayConnection.on("error", (err) => {
				if (!ready) {
					rej(err);
				} else {
					log.error?.(`Got an error on ${account.name}’s gateway connection. This account will be disconnected. ${err}`);
					account.disconnect();
					if (accounts.size === 0) {
						stop();
					}
				}
			});

			// TODO: This rate limiter needs to apply to each fetch, including repeated attempts after HTTP 429.
			// TODO: Abort without waiting for the rate limiter.
			const restRateLimiter = new RateLimiter(49, 1000);
			async function request<T>(endpoint: string, options = account.restOptions, abortIfFail?: boolean): Promise<RequestResult<T>> {
				await restRateLimiter.whenFree();
				const result = await apiReq<T>(endpoint, options, abortIfFail);
				if (result.response.status === 401 && accounts.has(account)) {
					log.error?.(`Got HTTP status 401 Unauthorized while using ${account.name}. The authentication token is no longer valid. This account will be disconnected.`);
					// This will immediately abort all operations
					account.disconnect();
					if (accounts.size === 0) {
						stop();
					}
				}
				return result;
			}

			async function disconnect() {
				if (!accounts.has(account))
					throw new Error("The account was already disconnected");

				accounts.delete(account);
				for (const reference of account.references) {
					reference.delete(account);
				}

				account.gatewayConnection.destroy();

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
				for (const { abortController, end } of account.ongoingExpressionUploaderRequests.values()) {
					endPromises.push(end);
					abortController.abort();
				}
				await Promise.all(endPromises);

				if (!ready) {
					rej(abortError);
				}
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

				disconnect,

				numberOfOngoingRESTOperations: 0,
				ongoingMessageSyncs: new Map(),
				ongoingPrivateThreadMessageSyncs: new Map(),
				ongoingPublicThreadListSyncs: new Map(),
				ongoingPrivateThreadListSyncs: new Map(),
				ongoingJoinedPrivateThreadListSyncs: new Map(),
				ongoingExpressionUploaderRequests: new Set(),

				numberOfOngoingGatewayOperations: 0,
				ongoingMemberRequests: new Set(),

				ongoingDispatchHandlers: new Set(),

				references: new Set(),
			};
			accounts.add(account);
		});
	}

	if (globalAbortSignal.aborted) return;

	// Cleanup
	let stopping = false;
	async function stop() {
		if (stopping) return;
		stopping = true;
		stopProgressDisplay();
		log.info?.("Exiting. (Press Ctrl+C again to terminate abruptly.)");
		globalAbortController.abort();
		log.verbose?.("Disconnecting all accounts.");
		await Promise.all(accounts.values().map(account => account.disconnect()));
		if (fileStore !== undefined) {
			log.verbose?.("Closing the file store.");
			await fileStore.close();
		}
		log.verbose?.("Closing the database.");
		await db.close();
		setTimeout(() => {
			log.debug?.("Runtime didn't exit after everything was cleaned up. Active handles: %O", (process as any)._getActiveHandles?.());
			process.exit();
		}, 2000).unref();
	}

	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);

	// Connect to all accounts
	await Promise.all(config.accounts.map((accountConfig, index) => connectAccount({
		name: accountConfig.name ?? `account #${index}`,
		mode: "bot",
		token: accountConfig.token,
		gatewayIdentifyData: Object.assign({
			intents:
				DT.GatewayIntent.Guilds |
				DT.GatewayIntent.GuildMessages |
				DT.GatewayIntent.GuildMessageReactions |
				DT.GatewayIntent.DirectMessages |
				DT.GatewayIntent.DirectMessageReactions |
				DT.GatewayIntent.GuildMembers |
				DT.GatewayIntent.GuildEmojisAndStickers,
			properties: {
				os: process.platform,
				browser: "DiscordArchiver/0.0.0",
				device: "DiscordArchiver/0.0.0",
			},
			token: accountConfig.token,
		}, accountConfig.gatewayIdentifyData),
		restHeaders: {},
	}).catch((err: unknown) => {
		const accountName = accountConfig.name ?? `account #${index}`;
		if (err === abortError) {
			log.verbose?.(`Connection of ${accountName} was aborted.`);
		} else {
			log.error?.(`Couldn't connect ${accountName}. ${(err as Error)}`);
		}
	})));

	if (accounts.size === 0) return;

	allReady = true;
	log.info?.("All accounts are ready.");

	for (const guild of guilds.values()) {
		if (!guild.options.archive) continue;
		(async () => {
			try {
				await guild.initialSyncPromise;
			} catch (err) {
				if (err !== abortError) {
					log.error?.("Unexpected error while awaiting the guild's initial sync promise after all accounts were ready.");
					throw err;
				} else {
					return;
				}
			}

			syncAllGuildMembers(getLeastGatewayOccupiedAccount(guild.accountData.keys())!, guild);
			if (guild.missingEmojiUploaders && guild.accountsWithExpressionPermission.size > 0) {
				requestExpressionUploaders(getLeastRESTOccupiedAccount(guild.accountsWithExpressionPermission)!, guild);
			}

			for (const thread of guild.activeThreads.values()) {
				// There should always be an account with read permission since otherwise we wouldn't
				// be able to see the thread.
				syncMessages(getLeastRESTOccupiedAccount(thread.parent.accountsWithReadPermission)!, thread);
			}

			for (const channel of guild.channels.values()) {
				if (!channel.textLike) continue;

				if (channel.options.archive && channel.accountsWithReadPermission.size > 0) {
					syncMessages(getLeastRESTOccupiedAccount(channel.accountsWithReadPermission)!, channel);

					if (channel.hasThreads && channel.accountsWithReadPermission.size > 0) {
						if (channel.accountsWithManageThreadsPermission.size > 0) {
							syncAllArchivedThreads(getLeastRESTOccupiedAccount(channel.accountsWithManageThreadsPermission)!, channel, ArchivedThreadListType.Private);
						}

						syncAllArchivedThreads(getLeastRESTOccupiedAccount(channel.accountsWithReadPermission)!, channel, ArchivedThreadListType.Public);
					}
				}
			}
		})();
	}
})();
