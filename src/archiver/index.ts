import { setProgress } from "../util/progress-display.js";

process.on("uncaughtExceptionMonitor", () => {
	setProgress();
	console.error("ERROR: An unexpected error happened! Please report this.");
});

import * as DT from "../discord-api/types.js";
import { AddGuildMemberSnapshotRequest, AddReactionPlacementRequest, AddReactionResult, AddSnapshotResult, getDatabaseConnection, GetLastSyncedMessageIDRequest, RequestType, SetLastSyncedMessageIDRequest, SingleResponseFor, Timing } from "../db/index.js";
import { GatewayCloseError, GatewayConnection } from "../discord-api/gateway/connection.js";
import { RequestResult, RestManager, RestOptions, RateLimitRoute } from "../discord-api/rest.js";
import { computeChannelPermissions, computeGuildPermissions } from "./permissions.js";
import { areMapsEqual } from "../util/map-equality.js";
import { abortError } from "../util/abort.js";
import { parseArgs, ParseArgsConfig } from "node:util";
import log from "../util/log.js";
import { getTag } from "../discord-api/tag.js";
import { CachedTextLikeChannel, CachedGuild, guilds, isGuildTextLikeChannel, CachedThread, CachedChannel, directChannels, cacheThread, cacheChannel, CachedPermissionOverwrites, updateGuildProperties } from "./cache.js";
import { Account, AccountOptions, accounts, getLeastGatewayOccupiedAccount, getLeastRESTOccupiedAccount, OngoingDispatchHandling, OngoingExpressionUploaderRequest, OngoingMessageSync, OngoingThreadSync } from "./accounts.js";
import { onArchiveMessages, onArchiveReactions, startProgressDisplay, stopProgressDisplay, updateProgressOutput } from "./progress.js";
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

	if (stats) {
		startProgressDisplay(fileStore);
	}

	// ARCHIVING

	class ExpectedError extends Error {
		// To prevent wrong `@typescript-eslint/no-base-to-string` lints
		declare toString: () => string;
	}

	function extractMessageFiles(message: DT.Message | DT.SnapshotMessage, options: MessageOptions, files: DownloadArguments[] = []): DownloadArguments[] {
		const emojis = extractEmojis(message.content);

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
		if (message.author?.avatar != null && options.downloadAuthorAvatars) {
			const avatarURL = getCDNHashURL(`/avatars/${message.author.id}`, message.author.avatar, config.mediaConfig.avatar, config.mediaConfig.animatedAvatar);
			files.push({ url: avatarURL, downloadURL: avatarURL });
		}

		for (const snapshot of message.message_snapshots ?? []) {
			extractMessageFiles(snapshot.message, options, files);
		}

		return files;
	}

	async function archiveMessageSnapshot(
		account: Account,
		message: DT.Message,
		cachedChannel: CachedTextLikeChannel | CachedThread,
		timestamp: number,
		realtime: boolean,
		fromCreateEvent: boolean,
		abortSignal: AbortSignal,
		includeReactions: boolean,
		files = extractMessageFiles(message, cachedChannel.options),
	): Promise<AddSnapshotResult> {
		const timing = fromCreateEvent ? null : { timestamp, realtime };

		const restOptions: RestOptions = {
			fetchOptions: mergeOptions(account.fetchOptions, { signal: abortSignal }),
			rateLimitRoute: RateLimitRoute.GetMessages,
			rateLimitID: cachedChannel.id,
		};
		const reactionRestOptions: RestOptions = {
			...restOptions,
			rateLimitRoute: RateLimitRoute.GetReactions,
		};

		type ReactionData = {
			emoji: DT.PartialEmoji;
			reactionType: 0 | 1;
			responses: {
				timestamp: number;
				users: DT.PartialUser[];
			}[];
		};
		const reactions: ReactionData[] = [];

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

					const reactionData: ReactionData = {
						emoji: reaction.emoji,
						reactionType,
						responses: [],
					};
					let count = 0;
					const emoji = reaction.emoji.id === null ? reaction.emoji.name : `${reaction.emoji.name}:${reaction.emoji.id}`;

					let userID = "0";
					while (true) {
						const { response, data } = await account.request<DT.PartialUser[]>(`/channels/${cachedChannel.id}/messages/${message.id}/reactions/${emoji}?limit=100&type=${reactionType}&after=${userID}`, reactionRestOptions);
						if (abortSignal.aborted) throw abortError;
						if (!response.ok) {
							throw new ExpectedError(`Got HTTP ${response.status} ${response.statusText} while requesting reactions for the message with ID ${message.id} from #${cachedChannel.name} (${cachedChannel.id})`);
						}
						const users = data!;

						onArchiveReactions(users.length);
						reactionData.responses.push({
							timestamp: Date.now(),
							users,
						});
						count += users.length;

						if (users.length < 100) {
							break;
						}
						userID = users.at(-1)!.id;
					}
					reactions.push(reactionData);

					if (count !== expectedCount) {
						log.verbose?.(`The reaction count (${expectedCount}) is different from the length of the list (${count}) of users who reacted to the message with ID ${message.id} from #${cachedChannel.name} (${cachedChannel.id}).`);
					}
				}
			}
		}

		let messageAddPromise: Promise<AddSnapshotResult>;
		await doDownloadTransaction(abortSignal, files, async () => {
			messageAddPromise = db.request({
				type: RequestType.AddMessageSnapshot,
				timing,
				timestamp,
				message: message,
			});
			for (const reactionData of reactions) {
				for (const { timestamp, users } of reactionData.responses) {
					db.request({
						type: RequestType.AddInitialReactions,
						timestamp,
						messageID: message.id,
						emoji: reactionData.emoji,
						reactionType: reactionData.reactionType,
						users,
					});
				}
			}
		});
		return await messageAddPromise!;
	}

	async function requestUser(account: Account, userID: string, abortSignal: AbortSignal): Promise<DT.PartialUser> {
		const restOptions: RestOptions = {
			fetchOptions: mergeOptions(account.fetchOptions, { signal: abortSignal }),
			rateLimitRoute: RateLimitRoute.GetUser,
		};

		const { response, data } = await account.request<DT.PartialUser>(`/users/${userID}`, restOptions);
		if (abortSignal.aborted) throw abortError;
		if (!response.ok) {
			throw new ExpectedError(`Got HTTP ${response.status} ${response.statusText} while requesting the user with ID ${userID}`);
		}

		return data!;
	}

	// SYNCING

	// TODO: Performance can be improved by not waiting for downloads from the previous chunk to
	// finish before starting the chunk downloads.
	async function syncMessages(account: Account, channel: CachedTextLikeChannel | CachedThread): Promise<void> {
		const abortController = new AbortController();
		const restOptions: RestOptions = {
			fetchOptions: mergeOptions(account.fetchOptions, { signal: abortController.signal }),
			rateLimitRoute: RateLimitRoute.GetMessages,
			rateLimitID: channel.id,
		};

		// Add this operation to the ongoing syncs list
		const { promise: end, resolve: endOperation } = Promise.withResolvers<void>();
		const sync: OngoingMessageSync = {
			type: "message-sync",
			abortController,
			end,
			account,
			channel,
			archivedMessageCount: 0,
			totalMessageCount: null,
			progress: null,
		};
		if (channel.messageSync !== null) {
			throw new Error("There can't be two message syncs for the same channel running simultaneously.");
		}
		channel.messageSync = sync;
		account.ongoingOperations.add(sync);
		account.numberOfOngoingRESTOperations++;
		updateProgressOutput();

		try {
			let messageID = channel.lastSyncedMessageID?.toString() ?? "0";
			log.verbose?.(`${messageID === "0" ? "Started" : "Resumed"} syncing messages from #${channel.name} (${channel.id})${messageID === "0" ? "" : ` after message ${messageID}`} using ${account.name}.`);

			let seenMessageCount = 0;
			let firstMessageIDNum: number | undefined;
			function updateProgress(count: number) {
				const lastSeenMessageIDNum = Number(messageID);
				const lastSyncedMessageIDNum = Number(channel.lastSyncedMessageID);
				const lastMessageIDNum = channel.lastMessageID === null ? null : Number(channel.lastMessageID satisfies bigint);
				sync.archivedMessageCount += count;
				sync.totalMessageCount =
					lastMessageIDNum === null ? null :
					(seenMessageCount / (lastSeenMessageIDNum - firstMessageIDNum!)) * (lastMessageIDNum - firstMessageIDNum!);
				sync.progress =
					lastMessageIDNum === null ? null :
					lastSyncedMessageIDNum === 0 ? 0 :
					(lastSyncedMessageIDNum - firstMessageIDNum!) / (lastMessageIDNum - firstMessageIDNum!);
				onArchiveMessages(count);
			}

			let previousIterationPromise: Promise<void> | undefined;

			while (true) {
				const { response, data } = await account.request<DT.Message[]>(`/channels/${channel.id}/messages?limit=100&after=${messageID}`, restOptions);
				if (abortController.signal.aborted) throw abortError;
				if (!response.ok) {
					log.warning?.(`Stopped syncing messages from #${channel.name} (${channel.id}) using ${account.name} because we got a ${response.status} ${response.statusText} response.`);
					break;
				}

				const timestamp = Date.now();
				const timing = {
					timestamp,
					realtime: false,
				};
				const messages = data!;

				const promises: Promise<unknown>[] = [];
				// All messages that don't require separate information to archive are grouped in
				// the same transaction to improve performance.
				const simpleMessages: DT.Message[] = [];

				if (messages.length > 0) {
					firstMessageIDNum ??= Number.parseInt(messages.at(-1)!.id);
					messageID = messages[0].id;
					seenMessageCount += messages.length;
					updateProgress(0);

					for (let i = messages.length - 1; i >= 0; i--) {
						const message = messages[i];
						if (i >= 1 && BigInt(messages[i-1].id) <= BigInt(message.id)) {
							throw new Error("Assertion failed: The messages aren't ordered in the message list response.");
						}

						const files = extractMessageFiles(message, channel.options);

						if (
							(channel.options.reactionArchivalMode === "users" && message.reactions !== undefined && message.reactions.length !== 0) ||
							files.length > 0
						) {
							const promise = archiveMessageSnapshot(account, message, channel, timestamp, false, false, abortController.signal, true, files)
								.then(() => {
									updateProgress(1);
								});
							promise.catch(() => {});
							promises.push(promise);
						} else {
							simpleMessages.push(message);
						}
					}

					const promise = db.transaction(async () => {
						for (const message of simpleMessages) {
							db.request({
								type: RequestType.AddMessageSnapshot,
								timing,
								timestamp,
								message,
							});
						}
					}).then(() => {
						updateProgress(simpleMessages.length);
					});
					promise.catch(() => {});
					promises.push(promise);
				}

				await previousIterationPromise;
				// This must be defined here in order to make sure that the value is from the current iteration.
				const lastStoredMessageID = BigInt(messageID);
				previousIterationPromise = (async () => {
					try {
						await Promise.all(promises);
					} catch (err) {
						// Ensure that we don't return before requesting more database operations
						await Promise.allSettled(promises);

						if (err instanceof ExpectedError) {
							log.warning?.(`Got an error while syncing messages from #${channel.name} (${channel.id}) using ${account.name}. This may be due to losing the ability to access the channel (for example, if the permissions changed). This sync operation will stop. ${err.toString()}.`);
							throw abortError;
						} else {
							throw err;
						}
					}

					const lastSyncedMessageID =
						messages.length >= 100 ?
							// We have not reached the end.
							lastStoredMessageID :
							// We have reached the end.
							// Take the maximum of `channel.lastMessageID` and `lastStoredMessageID` to
							// prevent needlessly syncing when `channel.lastMessageID` points to a
							// deleted message.
							channel.lastMessageID != null && channel.lastMessageID > lastStoredMessageID ?
								channel.lastMessageID :
								lastStoredMessageID;
					channel.lastSyncedMessageID = lastSyncedMessageID;
					await db.transaction(async () => {
						db.request({
							type: RequestType.SetLastSyncedMessageID,
							channelID: channel.id,
							isThread: channel.parent !== null,
							lastSyncedMessageID,
						} satisfies SetLastSyncedMessageIDRequest);
					});
				})();
				previousIterationPromise.catch(() => {});

				if (messages.length < 100) {
					// We've reached the end.
					await previousIterationPromise;
					log.verbose?.(`Finished syncing messages from #${channel.name} (${channel.id}) using ${account.name}.`);
					channel.areMessagesSynced = true;
					if (channel.parent !== null) {
						deleteThreadIfUseless(channel);
					}
					break;
				}
			}
		} catch (err) {
			if (err === abortError) {
				log.verbose?.(`Stopped syncing messages from #${channel.name} (${channel.id}) using ${account.name}.`);
			} else {
				log.error?.(`Unexpected error while syncing messages from #${channel.name} (${channel.id}) using ${account.name}: ${err as any}`);
				throw err;
			}
		} finally {
			// Remove this operation from the ongoing syncs list
			channel.messageSync = null;
			account.ongoingOperations.delete(sync);
			account.numberOfOngoingRESTOperations--;
			endOperation();
			updateProgressOutput();
		}
	}

	enum ArchivedThreadListType {
		Public,
		Private,
		JoinedPrivate,
	}
	async function syncArchivedThreads(account: Account, channel: CachedTextLikeChannel, type: ArchivedThreadListType) {
		const abortController = new AbortController();
		const restOptions: RestOptions = {
			fetchOptions: mergeOptions(account.fetchOptions, { signal: abortController.signal }),
			rateLimitRoute: RateLimitRoute.GetArchivedThreads,
		};

		const { promise: end, resolve: endOperation } = Promise.withResolvers<void>();
		const sync: OngoingThreadSync = { type: "thread-sync", abortController, end, account, channel };
		if (channel.publicThreadSync !== null) {
			throw new Error(`There can't be two ${ArchivedThreadListType[type]} archived thread syncs for the same channel running simultaneously.`);
		}
		channel.publicThreadSync = sync;
		account.ongoingOperations.add(sync);

		account.numberOfOngoingRESTOperations++;

		updateProgressOutput();

		try {
			let archiveTimestampString = "";

			log.verbose?.(`Started enumerating ${ArchivedThreadListType[type]} archived threads from #${channel.name} (${channel.id}) using ${account.name}.`);

			while (true) {
				const { response, data } = await account.request<DT.ListThreadsResponse>(
					type === ArchivedThreadListType.Public ? `/channels/${channel.id}/threads/archived/public?limit=100&before=${encodeURIComponent(archiveTimestampString)}` :
					type === ArchivedThreadListType.Private ? `/channels/${channel.id}/threads/archived/private?limit=100&before=${encodeURIComponent(archiveTimestampString)}` :
					`/channels/${channel.id}/users/@me/threads/archived/private?limit=100&before=${encodeURIComponent(archiveTimestampString)}`,
					restOptions,
				);
				if (abortController.signal.aborted) throw abortError;
				if (!response.ok) {
					log.warning?.(`Stopped enumerating ${ArchivedThreadListType[type]} archived threads from #${channel.name} (${channel.id}) using ${account.name} because we got a ${response.status} ${response.statusText} response.`);
					break;
				}
				const timestamp = Date.now();
				const list = data!;

				if (list.threads.length > 0) {
					archiveTimestampString = list.threads.at(-1)!.thread_metadata.archive_timestamp;

					await db.transaction(async () => {
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
						if (!thread.thread_metadata.archived) {
							throw new Error("Assertion failed: got an active thread while requesting archived threads");
						}
						let cachedThread = channel.threads.get(thread.id);
						cachedThread = cacheThread(cachedThread, thread, config, channel, false);
						updateMessageSync(cachedThread);
					}
				}
				if (!list.has_more) {
					break;
				}
			}

			log.verbose?.(`Finished enumerating ${ArchivedThreadListType[type]} archived threads from #${channel.name} (${channel.id}) using ${account.name}.`);
			channel.arePublicThreadsSynced = true;
		} catch (err) {
			if (err === abortError) {
				log.verbose?.(`Stopped enumerating ${ArchivedThreadListType[type]} archived threads from #${channel.name} (${channel.id}) using ${account.name}.`);
			} else {
				log.error?.("Unexpected error while syncing archived threads.");
				throw err;
			}
		} finally {
			channel.publicThreadSync = null;
			account.ongoingOperations.delete(sync);
			account.numberOfOngoingRESTOperations--;
			endOperation();

			updateProgressOutput();
		}
	}

	async function requestExpressionUploaders(account: Account, guild: CachedGuild) {
		const abortController = new AbortController();
		const restOptions: RestOptions = {
			fetchOptions: mergeOptions(account.fetchOptions, { signal: abortController.signal }),
			rateLimitRoute: RateLimitRoute.GetEmojis,
			rateLimitID: guild.id,
		};

		const { promise: end, resolve: endOperation } = Promise.withResolvers<void>();
		const operation: OngoingExpressionUploaderRequest = {
			type: "expression-uploader-request",
			abortController,
			end,
			account,
			guild: guild,
		};
		account.ongoingOperations.add(operation);
		account.numberOfOngoingRESTOperations++;
		updateProgressOutput();

		try {
			log.verbose?.(`Requesting the uploaders of emojis from guild ${guild.name} (${guild.id}) using ${account.name}.`);
			const { response, data } = await account.request<DT.CustomEmoji[]>(`/guilds/${guild.id}/emojis`, restOptions);
			if (!response.ok) {
				log.warning?.(`Got ${response.status} ${response.statusText} response while requesting the uploaders of emojis from guild ${guild.name} (${guild.id}) using ${account.name}.`);
				return;
			}
			const timestamp = Date.now();
			const emojisWithUploader = data!.filter((e => e.user != null) as (e: DT.CustomEmoji) => e is (DT.CustomEmoji & { user: DT.PartialUser }));

			if (emojisWithUploader.length !== data!.length) {
				if (emojisWithUploader.length === 0) {
					log.warning?.(`All emojis are missing an uploaders in the response to ${account.name}. This might happen if the account lost the manage guild expressions permission.`);
				} else {
					log.warning?.(`Some emojis are missing an uploaders in the response to ${account.name}.`);
				}
			} else {
				log.verbose?.(`Successfully obtained the uploaders of emojis from guild ${guild.name} (${guild.id}) using ${account.name}.`);
				guild.areEmojiUploadersSynced = true;

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
			}
		} catch (err) {
			if (err !== abortError) {
				log.error?.("Unexpected error while requesting expression uploaders.");
				throw err;
			}
		} finally {
			account.ongoingOperations.delete(operation);
			account.numberOfOngoingRESTOperations--;
			endOperation();
			updateProgressOutput();
		}
	}


	async function archiveMemberSnapshots(cachedGuild: CachedGuild, members: DT.GuildMember[], timing: Timing, abortSignal: AbortSignal) {
		const files: DownloadArguments[] = [];
		for (const member of members) {
			if (cachedGuild.options.downloadAllMemberAvatars) {
				if (member.user.avatar != null) {
					const iconURL = getCDNHashURL(`/avatars/${member.user.id}`, member.user.avatar, config.mediaConfig.avatar, config.mediaConfig.animatedAvatar);
					files.push({ url: iconURL, downloadURL: iconURL });
				}
				if (member.avatar != null) {
					const iconURL = getCDNHashURL(`/guilds/${cachedGuild.id}/users/${member.user.id}/avatars`, member.avatar, config.mediaConfig.avatar, config.mediaConfig.animatedAvatar);
					files.push({ url: iconURL, downloadURL: iconURL });
				}
				if (member.banner != null) {
					const iconURL = getCDNHashURL(`/guilds/${cachedGuild.id}/users/${member.user.id}/banners`, member.banner, config.mediaConfig.userBanner, config.mediaConfig.userBanner);
					files.push({ url: iconURL, downloadURL: iconURL });
				}
			}
		}

		await doDownloadTransaction(abortSignal, files, async () => {
			for (const member of members) {
				db.request({
					type: RequestType.AddGuildMemberSnapshot,
					member,
					guildID: cachedGuild.id,
					timing,
				} satisfies AddGuildMemberSnapshotRequest);
			}
		});
	}

	async function updateMessageSync(channel: CachedTextLikeChannel | CachedThread, invalidateSync?: boolean) {
		const accountsWithReadPermission = (channel.parent ?? channel).accountsWithReadPermission;
		if (invalidateSync || accountsWithReadPermission.length === 0) {
			channel.lastMessageID = null;
			channel.areMessagesSynced = false;
		}

		const options = channel.options;
		if (
			!allReady ||
			channel.pendingMessageSyncUpdate ||
			!(options.archiveMessages && options.requestPastMessages) ||
			// Checking the global abort signal is necessary to prevent making database requests after
			// the database was closed.
			globalAbortSignal.aborted
		) return;
		channel.pendingMessageSyncUpdate = true;

		if (channel.lastSyncedMessageID === undefined) {
			// If the request returns `undefined` (meaning that the channel isn't in the database),
			// then there are also no messages from that channel in the database, so we set it to 0.
			channel.lastSyncedMessageID = await db.request({
				type: RequestType.GetLastSyncedMessageID,
				channelID: channel.id,
				isThread: channel.parent !== null,
			} satisfies GetLastSyncedMessageIDRequest) ?? 0n;
		}
		if (channel.lastMessageID !== null) {
			channel.areMessagesSynced = channel.lastSyncedMessageID >= channel.lastMessageID;
		} else {
			channel.areMessagesSynced = false;
		}

		if (channel.parent !== null) {
			deleteThreadIfUseless(channel);
		}

		if (!channel.areMessagesSynced && channel.messageSync === null && accountsWithReadPermission.length > 0) {
			syncMessages(getLeastRESTOccupiedAccount(accountsWithReadPermission)!, channel);
		} else if (channel.messageSync !== null && !accountsWithReadPermission.includes(channel.messageSync.account)) {
			channel.messageSync.abortController.abort();
			await channel.messageSync.end;
			updateMessageSync(channel);
		}
		channel.pendingMessageSyncUpdate = false;
	}

	async function updatePublicThreadSync(channel: CachedTextLikeChannel, invalidateSync = false) {
		if (invalidateSync || channel.accountsWithReadPermission.length === 0) {
			channel.arePublicThreadsSynced = false;
		}

		if (
			!allReady ||
			channel.pendingPublicThreadSyncUpdate ||
			channel.type === DT.ChannelType.GuildVoice ||
			channel.type === DT.ChannelType.GuildStageVoice ||
			!channel.options.archiveThreads ||
			!channel.options.requestArchivedThreads ||
			globalAbortSignal.aborted
		) return;

		if (!channel.arePublicThreadsSynced && channel.publicThreadSync === null && channel.accountsWithReadPermission.length > 0) {
			syncArchivedThreads(getLeastRESTOccupiedAccount(channel.accountsWithReadPermission)!, channel, ArchivedThreadListType.Public);
		} else if (channel.publicThreadSync !== null && !channel.accountsWithReadPermission.includes(channel.publicThreadSync.account)) {
			channel.pendingPublicThreadSyncUpdate = true;
			channel.publicThreadSync.abortController.abort();
			await channel.publicThreadSync.end;
			channel.pendingPublicThreadSyncUpdate = false;
			updatePublicThreadSync(channel);
		}
	}

	async function updateGuildChannelRelatedSyncs(channel: CachedTextLikeChannel, invalidateSync?: boolean) {
		await channel.guild?.initialSyncPromise;
		updateMessageSync(channel, invalidateSync);
		updatePublicThreadSync(channel, invalidateSync);
		for (const thread of channel.threads.values()) {
			updateMessageSync(thread, invalidateSync);
		}
	}

	function updateMemberSync(guild: CachedGuild) {
		if (!guild.options.requestAllMembers) return;

		if (!guild.areMembersSynced && guild.memberSync === null && guild.accountData.size > 0) {
			syncAllGuildMembers(getLeastGatewayOccupiedAccount(guild.accountData.keys())!, guild);
		}
		// Member list requests can't be aborted.
	}

	async function updateEmojiUploaderSync(guild: CachedGuild) {
		if (
			!allReady ||
			guild.pendingEmojiUploaderSyncUpdate ||
			!guild.options.requestExpressionUploaders
		) return;

		if (guild.areEmojiUploadersSynced === undefined) {
			guild.pendingEmojiUploaderSyncUpdate = true;
			guild.areEmojiUploadersSynced = !await db.request({
				type: RequestType.CheckForMissingEmojiUploaders,
				guildID: guild.id,
			});
			guild.pendingEmojiUploaderSyncUpdate = false;
		}

		if (!guild.areEmojiUploadersSynced && guild.emojiUploaderSync === null && guild.accountsWithExpressionPermission.length > 0) {
			requestExpressionUploaders(getLeastRESTOccupiedAccount(guild.accountsWithExpressionPermission)!, guild);
		}
		// This is a single HTTP request, so it's not worth it to abort if the account loses permission.
	}

	function updateGuildRelatedSyncs(guild: CachedGuild) {
		updateMemberSync(guild);
		updateEmojiUploaderSync(guild);
		for (const cachedChannel of guild.channels.values()) {
			if (cachedChannel.textLike) {
				updateGuildChannelPermissions(cachedChannel);
			}
		}
	}

	// GATEWAY

	function updateGuildPermissions(guild: CachedGuild) {
		guild.accountsWithExpressionPermission.length = 0;

		for (const [account, accountData] of guild.accountData) {
			accountData.guildPermissions = computeGuildPermissions(account, guild, accountData.roles);

			const expressionPermissions = account.bot ?
				DT.Permission.ManageGuildExpressions :
				(DT.Permission.CreateGuildExpressions | DT.Permission.ManageGuildExpressions);
			const hasEmojiPermission = (accountData.guildPermissions & expressionPermissions) != 0n;
			if (hasEmojiPermission) {
				guild.accountsWithExpressionPermission.push(account);
			}
		}

		updateGuildRelatedSyncs(guild);
	}

	/**
	 * Updates the account sets in the cached channel object and aborts syncs for accounts which lost
	 * permission.
	 */
	function updateGuildChannelPermissions(cachedChannel: CachedTextLikeChannel, oldPermissionOverwrites?: CachedPermissionOverwrites) {
		if (
			oldPermissionOverwrites !== undefined &&
			areMapsEqual(cachedChannel.permissionOverwrites, oldPermissionOverwrites, (a, b) => a.allow === b.allow && a.deny === b.deny)
		) {
			return;
		}

		cachedChannel.accountsWithReadPermission.length = 0;
		cachedChannel.accountsWithManageThreadsPermission.length = 0;
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
				cachedChannel.accountsWithReadPermission.push(account);
			}
			if (hasManageThreadsPermission) {
				cachedChannel.accountsWithManageThreadsPermission.push(account);
			}
		}

		updateGuildChannelRelatedSyncs(cachedChannel);
	}

	function deleteThread(thread: CachedThread) {
		thread.parent.threads.delete(thread.id);
		thread.messageSync?.abortController.abort();
	}
	function deleteThreadIfUseless(thread: CachedThread) {
		// If this is an archived (closed) thread with all of its messages synced, then we no longer need it in memory.
		if (
			!thread.active && (
				thread.areMessagesSynced ||
				!thread.options.archiveMessages ||
				!thread.options.requestPastMessages
			)
		) {
			deleteThread(thread);
		}
	}
	function deleteChannel(channel: CachedChannel) {
		channel.guild?.channels.delete(channel.id);
		if (channel.textLike) {
			channel.messageSync?.abortController.abort();
			for (const thread of channel.threads.values()) {
				deleteThread(thread);
			}
		}
	}
	function deleteGuild(guild: CachedGuild) {
		guilds.delete(guild.id);
		for (const channel of guild.channels.values()) {
			deleteChannel(channel);
		}
	}

	function syncAllGuildMembers(account: Account, guild: CachedGuild) {
		if (!guild.options.requestAllMembers) return;
		log.verbose?.(`Started syncing guild members from ${guild.name} (${guild.id}) using ${account.name}.`);

		guild.memberSync = {
			type: "member-sync",
			account,
			guild,
			memberIDs: new Set(),
		};
		account.ongoingMemberSyncs.add(guild.memberSync);
		account.numberOfOngoingGatewayOperations++;
		updateProgressOutput();

		account.gatewayConnection.sendPayload({
			op: DT.GatewayOpcode.RequestGuildMembers,
			d: {
				guild_id: guild.id,
				query: "",
				limit: 0,
			},
		});
	}

	/**
	 * Connects an account and adds it to the accounts set.
	 *
	 * If connecting the account fails, the promise is resolved but the account is removed from the set.
	 */
	function connectAccount(accountOptions: AccountOptions): Promise<void> {
		return new Promise((res) => {
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
				const cachedGuild = getGuild(guildID, eventType);
				if (cachedGuild === undefined) return undefined;
				const cachedChannel = cachedGuild.channels.get(channelID);
				if (cachedChannel !== undefined) return cachedChannel;
				if (!includeThreads) {
					log.warning?.(`Received a ${eventType} dispatch for an unknown guild channel with ID ${channelID} belonging to the guild with ID ${guildID}.`);
					return undefined;
				}
				let cachedThread;
				for (const c of cachedGuild.channels.values()) {
					if (c.textLike) {
						cachedThread = c.threads.get(channelID);
						if (cachedThread) break;
					}
				}
				if (cachedThread === undefined) {
					log.warning?.(`Received a ${eventType} dispatch for an unknown guild channel or thread with ID ${channelID} belonging to the guild with ID ${guildID}.`);
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
				const operation: OngoingDispatchHandling = {
					type: "dispatch-handling",
					eventName: payload.t,
					abortController,
					end,
					account,
				};
				account.ongoingOperations.add(operation);
				updateProgressOutput();

				try {
					switch (payload.t) {
						case "READY": {
							account.details = {
								id: payload.d.user.id,
								tag: getTag(payload.d.user),
							};
							log.info?.(`Gateway connection ready for ${account.name} (${account.details.tag}).`);
							numberOfGuildsLeft = payload.d.guilds.length;

							for (const [guildID, cachedGuild] of guilds.entries()) {
								if (cachedGuild.accountData.has(account) && !payload.d.guilds.some(g => g.id === guildID)) {
									log.warning?.(`${account.name} was found to be removed from guild ${cachedGuild.name} (${guildID}) while the gateway connection was inactive.`);
									cachedGuild.accountData.delete(account);
									updateGuildPermissions(cachedGuild);
								}
							}
							break;
						}

						case "RESUMED": {
							log.verbose?.(`Gateway session resumed for ${account.name} (${account.details!.tag}).`);
							break;
						}

						case "GUILD_DELETE": {
							if (payload.d.unavailable) {
								onReceivedGuildInfo();
							} else {
								// This guild was deleted
								const cachedGuild = guilds.get(payload.d.id);
								if (cachedGuild === undefined) break;

								deleteGuild(cachedGuild);
							}
							break;
						}

						case "GUILD_CREATE": {
							onReceivedGuildInfo();
							const guild = payload.d;

							const ownMember = guild.members.find(m => m.user.id === account.details!.id)!;

							const options = getGuildOptions(config, guild.id);
							let cachedGuild = guilds.get(guild.id);

							let syncPromise: Promise<void>;
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
								syncPromise = doDownloadTransaction(abortController.signal, files, async () => {
									const guildSnapshotTiming = {
										timestamp,
										realtime: false,
									};

									// TODO: sync closed/deleted threads
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
								});
							} else {
								// This guild won't be archived
								syncPromise = Promise.resolve(undefined);
							}

							if (cachedGuild === undefined) {
								cachedGuild = {
									id: guild.id,
									options,
									name: guild.name,
									ownerID: guild.owner_id,
									rolePermissions: new Map(guild.roles.map(r => [r.id, BigInt(r.permissions)])),
									accountData: new Map(),
									accountsWithExpressionPermission: [],
									emojiIDs: new Set(guild.emojis.map(e => e.id)),
									channels: new Map(),
									areMembersSynced: false,
									memberSync: null,
									areEmojiUploadersSynced: undefined,
									pendingEmojiUploaderSyncUpdate: false,
									emojiUploaderSync: null,
									initialSyncPromise: syncPromise.then(() => undefined),
								};
								// Prevent this promise from causing an unhandled rejection while
								// propagating the error to awaiting consumers. Any error in this promise
								// will also be encountered by the `await` expression below.
								cachedGuild.initialSyncPromise.catch(() => {});
								guilds.set(guild.id, cachedGuild);
							} else {
								updateGuildProperties(cachedGuild, guild);
								cachedGuild.areMembersSynced = false;
							}

							for (const channel of guild.channels) {
								const cachedChannel = cachedGuild.channels.get(channel.id);
								cacheChannel(cachedChannel, channel, config, true, cachedGuild);
							}
							for (const thread of guild.threads) {
								if (thread.type === DT.ChannelType.PrivateThread) continue;
								const cachedParent = cachedGuild.channels.get(thread.parent_id) as CachedTextLikeChannel;
								const cachedThread = cachedParent.threads.get(thread.id);
								cacheThread(cachedThread, thread, config, cachedParent, true);
							}

							cachedGuild.accountData.set(account, {
								roles: new Set(ownMember.roles),
								guildPermissions: 0n, // will be computed below
							});
							updateGuildPermissions(cachedGuild);

							{
								const channelIDs = new Set(guild.channels.map(c => c.id));
								const threadIDs = new Set(guild.threads.map(t => t.id));
								for (const [channelID, cachedChannel] of cachedGuild.channels.entries()) {
									if (!channelIDs.has(channelID)) {
										// This channel was deleted.
										deleteChannel(cachedChannel);
									} else if (cachedChannel.textLike && cachedChannel.accountsWithReadPermission.includes(account)) {
										for (const [threadID, cachedThread] of cachedChannel.threads) {
											if (!threadIDs.has(threadID)) {
												// This thread was archived (closed) or deleted.
												// We don't know which, so we assume that it was archived (closed).
												cachedThread.active = false;
												deleteThreadIfUseless(cachedThread);
											}
										}
									}
								}
							}


							updateProgressOutput();

							await syncPromise;
							log.verbose?.(`${options.archive ? "Synced" : "Received"} basic guild info for ${cachedGuild.name} (${cachedGuild.id}) using ${account.name}.`);
							break;
						}
						case "GUILD_UPDATE": {
							const guild = payload.d;
							const cachedGuild = getGuild(guild.id, payload.t);
							if (cachedGuild === undefined) break;

							updateGuildProperties(cachedGuild, guild);
							updateGuildPermissions(cachedGuild);

							if (cachedGuild.options.storeServerEdits) {
								await cachedGuild.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddGuildSnapshot,
										guild,
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

								// We need to request the emoji uploaders in case a new emoji was added.
								cachedGuild.areEmojiUploadersSynced = undefined;
								updateEmojiUploaderSync(cachedGuild);
							}
							break;
						}

						case "GUILD_MEMBERS_CHUNK": {
							const isLast = payload.d.chunk_index === payload.d.chunk_count - 1;
							const cachedGuild = getGuild(payload.d.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							const sync = cachedGuild.memberSync;
							if (sync === null || sync.account !== account) {
								log.warning?.("Received an unexpected GUILD_MEMBERS_CHUNK dispatch.");
								break;
							}
							for (const member of payload.d.members) {
								sync.memberIDs.add(BigInt(member.user.id));
							}
							if (isLast) {
								log.verbose?.(`Finished syncing guild members from ${cachedGuild.name} (${cachedGuild.id}) using ${account.name}.`);
								cachedGuild.areMembersSynced = true;
								cachedGuild.memberSync = null;
								account.ongoingMemberSyncs.delete(sync);
								account.numberOfOngoingGatewayOperations--;
								updateProgressOutput();

								db.transaction(async () => {
									db.request({
										type: RequestType.SyncGuildMembers,
										guildID: BigInt(cachedGuild.id),
										userIDs: sync.memberIDs,
										timing: {
											timestamp,
											realtime: false,
										},
									});
								});
							}

							if (cachedGuild.options.storeMemberEvents) {
								await cachedGuild.initialSyncPromise;
								await archiveMemberSnapshots(cachedGuild, payload.d.members, timing, abortController.signal);
							}
							break;
						}

						case "GUILD_MEMBER_ADD": {
							const member = payload.d;
							const cachedGuild = getGuild(member.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							if (cachedGuild.options.storeMemberEvents) {
								await cachedGuild.initialSyncPromise;
								archiveMemberSnapshots(cachedGuild, [member], timing, abortController.signal);
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

							if (cachedGuild.options.storeMemberEvents) {
								await cachedGuild.initialSyncPromise;
								await archiveMemberSnapshots(cachedGuild, [member], timing, abortController.signal);
							}
							break;
						}
						case "GUILD_MEMBER_REMOVE": {
							const member = payload.d;
							const cachedGuild = getGuild(member.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							if (member.user.id === account.details!.id) {
								// This account was removed from the guild.
								// The cached guild is kept in memory forever even if all accounts leave
								// the guild to prevent multiple syncs from happening at the same time if
								// some account joins the guild, but that doesn't really matter.
								cachedGuild.accountData.delete(account);
								updateGuildPermissions(cachedGuild);
							}

							if (cachedGuild.options.storeMemberEvents) {
								await cachedGuild.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddGuildMemberLeave,
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
								if (cachedGuild.channels.has(channel.id)) break;
							} else if (DT.isDirectChannel(channel)) {
								if (directChannels.has(channel.id)) break;
							} else {
								const unknownChannel: any = channel satisfies never;
								log.warning?.(`Received a CHANNEL_CREATE event for a channel with ID ${unknownChannel.id} with an unknown type ${unknownChannel.type}.`);
							}

							const cachedChannel = cacheChannel(undefined, channel, config, true, cachedGuild);

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
							let cachedChannel = getChannel(payload.d, payload.t);
							if (cachedChannel === undefined) break;
							const channel = payload.d;

							if (isGuildTextLikeChannel(channel)) {
								cachedChannel = cachedChannel as CachedTextLikeChannel;
								const oldPermissions = cachedChannel.permissionOverwrites;
								cachedChannel = cacheChannel(cachedChannel, channel, config, false, cachedChannel.guild);
								updateGuildChannelPermissions(cachedChannel, oldPermissions);
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

						case "CHANNEL_DELETE": {
							const channel = payload.d;
							const cachedChannel = getChannel(channel, payload.t);
							if (cachedChannel === undefined) break;

							deleteChannel(cachedChannel);

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

						case "THREAD_CREATE":
						case "THREAD_UPDATE":
						{
							const thread = payload.d;
							if (thread.type === DT.ChannelType.PrivateThread) break;
							const cachedParent = getGuildChannel(thread.parent_id, thread.guild_id, payload.t) as CachedTextLikeChannel | undefined;
							if (cachedParent === undefined) break;
							let cachedThread = cachedParent.threads.get(thread.id);

							if (payload.t === "THREAD_UPDATE" && cachedThread === undefined) {
								log.warning?.(`Received a ${payload.t} dispatch for an unknown thread with ID ${thread.id}.`);
								break;
							}
							cachedThread = cacheThread(cachedThread, thread, config, cachedParent, false);

							if (cachedThread.options.storeChannelEdits) {
								await cachedParent.guild!.initialSyncPromise;
								await db.transaction(async () => {
									db.request({
										type: RequestType.AddThreadSnapshot,
										thread,
										timing: (payload.t === "THREAD_CREATE" && payload.d.newly_created) ? null : timing,
									});
								});
							}
							break;
						}
						case "THREAD_DELETE": {
							if (payload.d.type === DT.ChannelType.PrivateThread) break;
							const cachedParent = getGuildChannel(payload.d.parent_id, payload.d.guild_id, payload.t) as CachedTextLikeChannel | undefined;
							if (cachedParent === undefined) break;
							const cachedThread = cachedParent.threads.get(payload.d.id);
							if (cachedThread === undefined) break;

							deleteThread(cachedThread);

							if (cachedThread.options.storeChannelEdits) {
								await db.transaction(async () => {
									db.request({
										type: RequestType.MarkThreadAsDeleted,
										id: payload.d.id,
										timing,
									});
								});
							}
							break;
						}
						// It seems that, for user accounts, the READY event only contains joined active threads and this event is sent later with the non-joined but active threads.
						// This event is sent (containing all active threads) when the user gains access to a channel if and only if there are active threads in that channel.
						case "THREAD_LIST_SYNC": {
							// TODO: sync closed/deleted threads
							const threadsToArchive: DT.Thread[] = [];

							const cachedGuild = getGuild(payload.d.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							for (const thread of payload.d.threads) {
								if (thread.type === DT.ChannelType.PrivateThread) continue;
								const cachedParent = cachedGuild.channels.get(thread.parent_id) as CachedTextLikeChannel | undefined;
								if (cachedParent === undefined) {
									log.warning?.(`Received a THREAD_LIST_SYNC event for an unknown channel with ID ${thread.parent_id}.`);
									break;
								}

								let cachedThread = cachedParent.threads.get(thread.id);
								cachedThread = cacheThread(cachedThread, thread, config, cachedParent, false);

								if (cachedThread.options.archiveThreads) {
									threadsToArchive.push(thread);
									updateMessageSync(cachedThread);
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

						case "MESSAGE_CREATE":
						case "MESSAGE_UPDATE":
						{
							const cachedChannel = getChannelOrThreadByIDs(payload.d.channel_id, payload.d.guild_id, payload.t) as CachedTextLikeChannel | CachedThread | undefined;
							if (cachedChannel === undefined) break;
							const message = payload.d;

							if (
								payload.t === "MESSAGE_CREATE" ?
									cachedChannel.options.storeNewMessages :
									cachedChannel.options.storeMessageEdits
							) {
								// It's necessary to await the initial sync because it's possible to
								// receive a MESSAGE_CREATE event after the GUILD_CREATE or READY
								// event but before the guild's data is in the database.
								await cachedChannel.guild?.initialSyncPromise;
								try {
									await archiveMessageSnapshot(
										account,
										message,
										cachedChannel,
										timestamp,
										realtime,
										payload.t === "MESSAGE_CREATE",
										abortController.signal,
										false,
									);
								} catch (err) {
									if (err instanceof ExpectedError) {
										console.warn(`Couldn't archive a new or newly edited message. This may be due to losing the ability to access the message (for example, if it was deleted). Error: ${err.toString()}`);
									} else {
										throw err;
									}
								}
								if (
									payload.t === "MESSAGE_CREATE" &&
									cachedChannel.areMessagesSynced &&
									cachedChannel.lastSyncedMessageID !== undefined
								) {
									const messageID = BigInt(message.id);
									// Only update if the ID increased to prevent message syncing and MESSAGE_CREATE handling from interfering.
									if (messageID > cachedChannel.lastSyncedMessageID) {
										cachedChannel.lastSyncedMessageID = messageID;
									}
									await db.request({
										type: RequestType.SetLastSyncedMessageID,
										channelID: cachedChannel.id,
										isThread: cachedChannel.parent !== null,
										lastSyncedMessageID: cachedChannel.lastSyncedMessageID,
									} satisfies SetLastSyncedMessageIDRequest);
								}
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
							const cachedChannel = getChannelOrThreadByIDs(payload.d.channel_id, payload.d.guild_id, payload.t) as CachedTextLikeChannel | CachedThread | undefined;
							if (cachedChannel === undefined) break;

							if (cachedChannel.options.reactionArchivalMode === "users" && cachedChannel.options.storeReactionEvents) {
								await cachedChannel.guild?.initialSyncPromise;

								const request: AddReactionPlacementRequest = {
									type: RequestType.AddReactionPlacement,
									messageID: payload.d.message_id,
									emoji: payload.d.emoji,
									reactionType: payload.d.burst ? DT.ReactionType.Burst : DT.ReactionType.Normal,
									userID: payload.d.user_id,
									user: payload.d.member?.user,
									timing,
								};

								let responsePromise: Promise<SingleResponseFor<AddReactionPlacementRequest>>;
								await db.transaction(async () => {
									responsePromise = db.request(request);
								});
								const response = await responsePromise!;

								if (response === AddReactionResult.MissingMessage) {
									break;
								}
								if (response === AddReactionResult.MissingUser) {
									// The user isn't in the database yet.
									let user;
									try {
										user = await requestUser(account, payload.d.user_id, abortController.signal);
									} catch (err) {
										if (err instanceof ExpectedError) {
											log.error?.(`Got an error while requesting the user with ID ${payload.d.user_id} missing from the database while archiving a reaction to a message from #${cachedChannel.name} (${cachedChannel.id}) ${err.toString()}.`);
											break;
										} else {
											throw err;
										}
									}
									await db.transaction(async () => {
										db.request({
											type: RequestType.AddUserSnapshot,
											timing: {
												timestamp,
												realtime: false,
											},
											user,
										});
										db.request(request);
									});
								}
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
										reactionType: payload.d.burst ? DT.ReactionType.Burst : DT.ReactionType.Normal,
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

						// This event is dispatched instead of GUILD_MEMBER_UPDATE for changes to `deaf` and `mute`.
						case "VOICE_STATE_UPDATE": {
							if (payload.d.guild_id == null || payload.d.member == null) break;
							const member = payload.d.member;
							const cachedGuild = getGuild(payload.d.guild_id, payload.t);
							if (cachedGuild === undefined) break;

							if (cachedGuild.options.storeMemberEvents) {
								await cachedGuild.initialSyncPromise;
								await archiveMemberSnapshots(cachedGuild, [member], timing, abortController.signal);
							}
							break;
						}
					}
				} catch (err) {
					if (err !== abortError) {
						throw err;
					}
				} finally {
					account.ongoingOperations.delete(operation);
					endOperation();
					updateProgressOutput();
				}
			});

			gatewayConnection.on("sessionLost", () => {
				log.warning?.(`Gateway session lost for ${account.name}. Some events may have been missed, so it's necessary to resync.`);

				// Handle interrupted member requests
				for (const sync of account.ongoingMemberSyncs) {
					const guild = sync.guild;
					log.verbose?.(`Member request for guild ${guild.name} (${guild.id}) was interrupted.`);
					guild.memberSync = null;
				}
				account.ongoingMemberSyncs.clear();
				updateProgressOutput();
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
				if (err instanceof GatewayCloseError && err.code === 4004) {
					log.error?.(`Got a 4004 gateway close code for ${account.name}. The authentication token is invalid. This account will be disconnected.`);
				} else {
					log.error?.(`Got an error on ${account.name}’s gateway connection. This account will be disconnected. ${err}`);
				}
				account.disconnect();
				if (accounts.size === 0) {
					stop();
				}
			});

			// TODO: Abort without waiting for the rate limiter.
			const restManager = new RestManager();
			async function request<T>(endpoint: string, options: RestOptions): Promise<RequestResult<T>> {
				const result = await restManager.request<T>(endpoint, options);
				if (result.response.status === 401 && accounts.has(account)) {
					log.error?.(`Got HTTP status 401 Unauthorized while using ${account.name}. The authentication token is invalid. This account will be disconnected.`);
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

				account.gatewayConnection.destroy();

				// Member syncs don't need to be aborted.
				const endPromises = [];
				for (const { abortController, end } of account.ongoingOperations) {
					endPromises.push(end);
					abortController?.abort();
				}
				await Promise.all(endPromises);

				if (!stopping) {
					// Move the syncs from this account to another one.
					for (const guild of guilds.values()) {
						updateGuildRelatedSyncs(guild);
					}
				}

				if (!ready) {
					res();
				}
			}

			const account: Account = {
				...accountOptions,
				bot,
				details: undefined,
				gatewayConnection,
				fetchOptions: {
					headers: {
						authorization: accountOptions.token,
					},
				},
				request,

				disconnect,

				numberOfOngoingRESTOperations: 0,
				numberOfOngoingGatewayOperations: 0,
				ongoingOperations: new Set(),
				ongoingMemberSyncs: new Set(),
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
		log.info?.("Exiting. (Press Ctrl+C to terminate abruptly.)");
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

			updateGuildRelatedSyncs(guild);
		})();
	}
})();
