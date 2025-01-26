/**
 * @fileoverview Actually connects to the database. The `better-sqlite3` connection is always sync.
 * This file can be imported directly for a sync interface or via `worker.ts` for an async one.
 */

// TODO: Add support for Bun's `bun:sqlite`?
import * as fs from "node:fs";
import * as DT from "../discord-api/types.js";
import { default as SQLite, Statement, SqliteError } from "better-sqlite3";
import { SingleRequest, ResponseFor, Timing, RequestType, IteratorRequest, IteratorResponseFor, GetGuildChannelsRequest, GetDMChannelsRequest, GetChannelMessagesRequest, AddSnapshotResult } from "./types.js";
import { encodeSnowflakeArray, encodeObject, ObjectType, encodeImageHash, decodeObject, encodePermissionOverwrites, decodePermissionOverwrites, decodeImageHash, encodeEmoji, encodeEmojiProps, DiscordEmojiProps } from "./generic-encoding.js";
import { mapIterator } from "../util/iterators.js";

const SNOWFLAKE_LOWER_BOUND = 281474976710656n; // 2n ** 48n

export type RequestHandler = {
	<R extends SingleRequest>(req: R): ResponseFor<R>;
	<R extends IteratorRequest>(req: R): IterableIterator<IteratorResponseFor<R>>;
	<R extends SingleRequest | IteratorRequest>(req: R):
	R extends SingleRequest ? ResponseFor<R> :
	R extends IteratorRequest ? IterableIterator<IteratorResponseFor<R>> :
	never;
};

export function getRequestHandler({ path, log }: { path: string; log?: typeof import("../util/log.js").default }): RequestHandler {
	const db = new SQLite(path, {
		verbose: log?.debug,
	});
	db.defaultSafeIntegers(true);
	db.pragma("trusted_schema = OFF");
	db.pragma("journal_mode = WAL");
	db.pragma("synchronous = NORMAL");
	db.pragma("foreign_keys = ON");

	if (db.pragma("user_version", { simple: true }) === 0n) {
		db.exec(
			fs.readFileSync(new URL("../../schema.sql", import.meta.url), "utf-8")
				// Remove comments and unnecessary whitespace
				.replace(/(?:\s|--.*)+/g, " "),
		);
	}

	type ObjectStatements = {
		/** Checks if there is at least one snapshot of the object archived. */
		doesExist: Statement;
		/** Gets the latest snapshot for an object with a given `id`, or all objects if and only if `$getAll` is `1` */
		getLatestSnapshot: Statement;
		/** Checks if the snapshot properties of the latest snapshot are equal to those of the provided object. */
		isLatestSnapshotEqual: Statement;
		/** Gets the _timestamp value of the latest snapshot. */
		getLatestTimestamp: Statement;
		/** Adds a snapshot to the table of latest snapshots. */
		addLatestSnapshot: Statement;
		/** Copies the latest snapshot to the table of the previous snapshots. */
		copyLatestSnapshot: Statement;
		/** Modifies the snapshot properties of the latest snapshot. */
		replaceLatestSnapshot: Statement;
	};
	/** Prepared statements for objects which can only be deleted once. */
	type DeletableObjectStatements = ObjectStatements & {
		/** Sets the _deleted timestamp. */
		markAsDeleted: Statement;
	};
	type ChildObjectStatements = DeletableObjectStatements & {
		/** Gets the latest snapshot for all child objects of a given parent */
		getLatestSnapshotsByParentID: Statement;
		/** Counts the child objects of a given parent */
		countObjectsByParentID: Statement;
		/** Gets the IDs of all non-deleted objects */
		getNotDeletedObjectIDsByParentID: Statement;
	};

	function getStatements(objectName: string, parentIDName: null, snapshotKeys: string[], objectKeys: string[]): DeletableObjectStatements;
	function getStatements(objectName: string, parentIDName: string, snapshotKeys: string[], objectKeys: string[]): ChildObjectStatements;
	function getStatements(objectName: string, parentIDName: string | null, snapshotKeys: string[], objectKeys: string[]): DeletableObjectStatements {
		const sk = snapshotKeys.join(", ");
		const sv = snapshotKeys.map(k => ":" + k).join(", ");
		const ok = objectKeys.map(k => k + ", ").join("");
		const ov = objectKeys.map(k => `:${k}, `).join("");
		const statements = {
			doesExist: db.prepare(`\
SELECT 1 FROM latest_${objectName}_snapshots WHERE id = :id;
`),
			getLatestSnapshot: db.prepare(`\
SELECT id, _deleted, ${ok} _timestamp, ${sk} FROM latest_${objectName}_snapshots WHERE id = :id OR :$getAll = 1;
`),
			isLatestSnapshotEqual: db.prepare(`\
SELECT 1 FROM latest_${objectName}_snapshots WHERE id = :id AND ${snapshotKeys.map(k => `${k} IS :${k}`).join(" AND ")};
`),
			getLatestTimestamp: db.prepare(`\
SELECT _timestamp FROM latest_${objectName}_snapshots WHERE id = :id;
`),
			addLatestSnapshot: db.prepare(`\
INSERT INTO latest_${objectName}_snapshots (id, ${ok} _timestamp, ${sk})
VALUES (:id, ${ov} :_timestamp, ${sv});
`),
			copyLatestSnapshot: db.prepare(`\
INSERT INTO previous_${objectName}_snapshots (id, _timestamp, ${sk})
SELECT id, _timestamp, ${sk} FROM latest_${objectName}_snapshots WHERE id = :id;
`),
			replaceLatestSnapshot: db.prepare(`\
UPDATE latest_${objectName}_snapshots SET _timestamp = :_timestamp, ${snapshotKeys.map(k => `${k} = :${k}`).join(", ")} WHERE id = :id;
`),
			markAsDeleted: db.prepare(`\
UPDATE latest_${objectName}_snapshots SET _deleted = :_deleted WHERE id = :id;
`),
		};
		if (parentIDName !== null) {
			Object.assign(statements, {
				getLatestSnapshotsByParentID: db.prepare(`\
SELECT id, _deleted, ${ok} _timestamp, ${sk} FROM latest_${objectName}_snapshots WHERE ${parentIDName} IS :$parentID;
`),
				countObjectsByParentID: db.prepare(`\
SELECT count(*) FROM latest_${objectName}_snapshots WHERE ${parentIDName} IS :$parentID;
`),
				getNotDeletedObjectIDsByParentID: db.prepare(`\
SELECT id FROM latest_${objectName}_snapshots WHERE ${parentIDName} IS :$parentID AND _deleted IS NULL;
`),
			} satisfies Omit<ChildObjectStatements, keyof DeletableObjectStatements>);
		}
		return statements;
	}
	const statements = {
		beginTransaction: db.prepare("BEGIN;"),
		commitTransaction: db.prepare("COMMIT;"),
		optimize: db.prepare("PRAGMA optimize;"),
		vacuum: db.prepare("VACUUM;"),
		getChanges: db.prepare("SELECT changes();"),

		findWebhookUserID: db.prepare("SELECT internal_id FROM webhook_users WHERE webhook_id IS :webhook_id AND username IS :username AND avatar IS :avatar;"),
		addWebhookUser: db.prepare("INSERT INTO webhook_users (webhook_id, username, avatar) VALUES (:webhook_id, :username, :avatar);"),
		getWebhookUser: db.prepare("SELECT webhook_id, username, avatar FROM webhook_users WHERE internal_id = :internal_id;"),

		addAttachment: db.prepare("INSERT OR IGNORE INTO attachments (id, _message_id, filename, description, content_type, size, height, width, ephemeral, duration_secs, waveform) VALUES (:id, :_message_id, :filename, :description, :content_type, :size, :height, :width, :ephemeral, :duration_secs, :waveform);"),

		// findReactionEmoji: db.prepare("SELECT internal_id FROM reaction_emojis WHERE id IS :id;"),
		addReactionEmoji: db.prepare("INSERT OR IGNORE INTO reaction_emojis (id, name, animated) VALUES (:id, :name, :animated);"),
		addReactionPlacement: db.prepare("INSERT INTO reactions (message_id, emoji, type, user_id, start, end) VALUES (:message_id, :emoji, :type, :user_id, :start, NULL);"),
		markReactionAsRemoved: db.prepare("UPDATE reactions SET end = :end WHERE message_id IS :message_id AND emoji IS :emoji AND type IS :type AND user_id IS :user_id AND end IS NULL;"),
		markReactionsAsRemovedByMessage: db.prepare("UPDATE reactions SET end = :end WHERE message_id IS :message_id AND end IS NULL;"),
		markReactionsAsRemovedByMessageAndEmoji: db.prepare("UPDATE reactions SET end = :end WHERE message_id IS :message_id AND emoji IS :emoji AND end IS NULL;"),
		checkForReaction: db.prepare("SELECT 1 FROM reactions WHERE message_id IS :message_id AND emoji IS :emoji AND type IS :type AND user_id IS :user_id AND end IS NULL;"),

		findFileByHash: db.prepare("SELECT url FROM files WHERE content_hash IS :content_hash;"),
		addFile: db.prepare("INSERT OR IGNORE INTO files (url, content_hash, error_code) VALUES (:url, :content_hash, :error_code);"),

		getLastMessageID: db.prepare("SELECT max(id) FROM latest_message_snapshots WHERE channel_id = :channel_id;"),
	} as const;
	const objectStatements = {
		user: getStatements("user", null, ["username", "discriminator", "global_name", "avatar", "public_flags"], ["bot"]),
		guild: getStatements("guild", null, ["name", "icon", "splash", "discovery_splash", "owner_id", "afk_channel_id", "afk_timeout", "widget_enabled", "widget_channel_id", "verification_level", "default_message_notifications", "explicit_content_filter", "mfa_level", "system_channel_id", "system_channel_flags", "rules_channel_id", "max_presences", "max_members", "vanity_url_code", "description", "banner", "premium_tier", "premium_subscription_count", "preferred_locale", "public_updates_channel_id", "max_video_channel_users", "nsfw_level", "premium_progress_bar_enabled"], []),
		role: getStatements("role", "_guild_id", ["name", "color", "hoist", "icon", "unicode_emoji", "position", "permissions", "mentionable", "flags", "tags__integration_id", "tags__subscription_listing_id", "tags__available_for_purchase", "tags__guild_connections"], ["_guild_id", "managed", "tags__bot_id", "tags__premium_subscriber"]),
		member: {
			doesExist: db.prepare(`\
SELECT 1 FROM latest_member_snapshots WHERE _user_id = :_user_id AND _guild_id = :_guild_id;
`),
			getLatestSnapshot: db.prepare(`\
SELECT _user_id, _guild_id, _timestamp, nick, avatar, roles, joined_at, premium_since, pending, communication_disabled_until FROM latest_member_snapshots WHERE _user_id = :_user_id AND _guild_id = :_guild_id;
`),
			isLatestSnapshotEqual: db.prepare(`
SELECT 1 FROM latest_member_snapshots WHERE _user_id = :_user_id AND _guild_id = :_guild_id AND nick IS :nick AND avatar IS :avatar AND roles IS :roles AND joined_at IS :joined_at AND premium_since IS :premium_since AND pending IS :pending AND communication_disabled_until IS :communication_disabled_until;
`),
			getLatestTimestamp: db.prepare(`\
SELECT _timestamp FROM latest_member_snapshots WHERE _user_id = :_user_id AND _guild_id = :_guild_id;
`),
			addLatestSnapshot: db.prepare(`\
INSERT INTO latest_member_snapshots (_user_id, _guild_id, _timestamp, nick, avatar, roles, joined_at, premium_since, pending, communication_disabled_until)
VALUES (:_user_id, :_guild_id, :_timestamp, :nick, :avatar, :roles, :joined_at, :premium_since, :pending, :communication_disabled_until);
`),
			copyLatestSnapshot: db.prepare(`\
INSERT INTO previous_member_snapshots (_user_id, _guild_id, _timestamp, nick, avatar, roles, joined_at, premium_since, pending, communication_disabled_until)
SELECT _user_id, _guild_id, _timestamp, nick, avatar, roles, joined_at, premium_since, pending, communication_disabled_until FROM latest_member_snapshots WHERE _user_id = :_user_id AND _guild_id = :_guild_id;
`),
			replaceLatestSnapshot: db.prepare(`\
UPDATE latest_member_snapshots SET _timestamp = :_timestamp, nick = :nick, avatar = :avatar, roles = :roles, joined_at = :joined_at, premium_since = :premium_since, pending = :pending, communication_disabled_until = :communication_disabled_until WHERE _user_id = :_user_id AND _guild_id = :_guild_id;
`),
			getNotLeftUserIDsByGuildID: db.prepare(`\
SELECT _user_id FROM latest_member_snapshots WHERE _guild_id IS :_guild_id AND joined_at IS NOT NULL;
`),
		},
		channel: getStatements("channel", "guild_id", ["position", "permission_overwrites", "name", "topic", "nsfw", "bitrate", "user_limit", "rate_limit_per_user", "icon", "owner_id", "parent_id", "rtc_region", "video_quality_mode", "thread_metadata__archived", "thread_metadata__auto_archive_duration", "thread_metadata__archive_timestamp", "thread_metadata__locked", "thread_metadata__invitable", "thread_metadata__create_timestamp", "default_auto_archive_duration", "flags", "applied_tags", "default_reaction_emoji", "default_thread_rate_limit_per_user", "default_sort_order", "default_forum_layout"], ["guild_id", "type"]),
		forumTag: getStatements("forum_tag", "channel_id", ["name", "moderated", "emoji"], ["channel_id"]),
		message: {
			...getStatements("message", "channel_id", ["content", "flags", "embeds", "components", "_attachment_ids"], ["channel_id", "author__id", "tts", "mention_everyone", "mention_roles", "type", "activity__type", "activity__party_id", "message_reference__message_id", "message_reference__channel_id", "message_reference__guild_id", "interaction__id", "interaction__type", "interaction__name", "interaction__user__id", "_sticker_ids"]),
			getLatestSnapshotsWithWHUsersByParentID: db.prepare(`\
SELECT
channel_id, author__id, tts, mention_everyone, mention_roles, type, activity__type, activity__party_id, message_reference__message_id, message_reference__channel_id, message_reference__guild_id, interaction__id, interaction__type, interaction__name, interaction__user__id, _sticker_ids, content, flags, embeds, components,
webhook_id, username, avatar
FROM latest_message_snapshots
LEFT JOIN webhook_users
ON latest_message_snapshots.author__id < ${SNOWFLAKE_LOWER_BOUND} AND webhook_users.internal_id = latest_message_snapshots.author__id
WHERE channel_id = :$parentID OR :$getAll = 1;
`),
			search: db.prepare(`\
SELECT
	latest_message_snapshots._timestamp, latest_message_snapshots._deleted,
	latest_message_snapshots.id, highlight(message_fts_index, 0, :$startDelimiter, :$endDelimiter) AS content, latest_message_snapshots.flags, latest_message_snapshots.embeds,
	latest_message_snapshots.author__id AS user_id, ifnull(latest_user_snapshots.username, webhook_users.username) AS username, latest_user_snapshots.discriminator,
	latest_message_snapshots.channel_id, channel.name AS channel_name,
	parent_channel.id AS parent_channel_id, parent_channel.name AS parent_channel_name,
	ifnull(channel.guild_id, parent_channel.guild_id) AS guild_id, latest_guild_snapshots.name AS guild_name
FROM message_fts_index
JOIN latest_message_snapshots ON latest_message_snapshots.id = message_fts_index.rowid
LEFT JOIN latest_user_snapshots ON latest_user_snapshots.id = latest_message_snapshots.author__id
LEFT JOIN webhook_users ON latest_message_snapshots.author__id < ${SNOWFLAKE_LOWER_BOUND} AND webhook_users.internal_id = latest_message_snapshots.author__id
LEFT JOIN latest_channel_snapshots channel ON channel.id = latest_message_snapshots.channel_id
LEFT JOIN latest_channel_snapshots parent_channel ON (channel.type BETWEEN 10 AND 12) AND parent_channel.id = channel.parent_id
LEFT JOIN latest_guild_snapshots ON latest_guild_snapshots.id = channel.guild_id OR latest_guild_snapshots.id = parent_channel.guild_id
WHERE message_fts_index MATCH :$query;
`),
		},
	} as const;

	function encodeTiming(timing: Timing | null): bigint {
		return timing === null ? 0n : BigInt(timing.timestamp) << 1n | BigInt(timing.realtime);
	}
	function assignTiming(target: any, timing: Timing | null): any {
		return Object.assign(target, {
			_timestamp: encodeTiming(timing),
		});
	}
	function decodeTiming(timing: bigint | null): Timing | null {
		return timing === null || timing === 0n ? null : {
			timestamp: Number(timing >> 1n),
			realtime: Boolean(timing & 1n),
		};
	}

	// TODO: Benchmark and optimize
	/**
	 * Adds a snapshot of an object to the database.
	 * @param partial If `true`, get the properties missing in `object` from the latest recorded snapshot
	 * @param checkIfChanged If `true`, prevent recording a snapshot that is equal to the latest snapshot
	 */
	function addSnapshot(statements: ObjectStatements, object: any, partial = false, checkIfChanged = true): AddSnapshotResult {
		if (partial) {
			// `object` has fields missing. Add the missing fields from the last snapshot.
			object.$getAll = 0;
			const oldObject = statements.getLatestSnapshot.get(object);
			if (!oldObject) {
				try {
					// This will probably throw since there are probably properties missing
					statements.addLatestSnapshot.run(object);
					return AddSnapshotResult.AddedFirstSnapshot;
				} catch (err) {
					if (err instanceof RangeError && err.message.startsWith("Missing named parameter")) {
						return AddSnapshotResult.PartialNoSnapshot;
					} else {
						throw err;
					}
				}
			}
			object = Object.assign(oldObject, object);
		} else {
			if (statements.doesExist.get(object) === undefined) {
				statements.addLatestSnapshot.run(object);
				return AddSnapshotResult.AddedFirstSnapshot;
			}
		}

		if (checkIfChanged && statements.isLatestSnapshotEqual.get(object)) {
			return AddSnapshotResult.SameAsLatest;
		} else {
			if (checkIfChanged && BigInt(object._timestamp) <= (statements.getLatestTimestamp.get(object) as any)._timestamp) {
				throw RangeError("The added snapshot is not more recent than the latest one in the database but it's not equal to it.");
			}
			statements.copyLatestSnapshot.run(object);
			statements.replaceLatestSnapshot.run(object);
			return AddSnapshotResult.AddedAnotherSnapshot;
		}
	}

	/** Marks as deleted all child objects of a specific parent whose IDs are not in a set. */
	function syncDeletions(statements: ChildObjectStatements, parentID: bigint, ids: Set<bigint>, timestamp: bigint) {
		const stored = statements.getNotDeletedObjectIDsByParentID.all({ $parentID: parentID }) as any[];
		for (const { id } of stored) {
			if (!ids.has(id)) {
				statements.markAsDeleted.run({ id, _deleted: timestamp });
			}
		}
	}

	function getChanges(): bigint {
		return (statements.getChanges.get() as any)["changes()"];
	}

	function iso8601ToNumber(timestamp: string | null): number {
		return timestamp == null ? 0 : new Date(timestamp).getTime();
	}
	function numberToISO8601(timestamp: number): string | null {
		return timestamp === 0 ? null : new Date(timestamp).toISOString();
	}

	return (req: SingleRequest | IteratorRequest) => {
		let response: any = undefined;
		switch (req.type) {
			case RequestType.Close: {
				statements.optimize.run();
				db.close();
				break;
			}
			case RequestType.BeginTransaction: {
				statements.beginTransaction.run();
				break;
			}
			case RequestType.CommitTransaction: {
				statements.commitTransaction.run();
				break;
			}
			case RequestType.Optimize: {
				statements.optimize.run();
				break;
			}
			case RequestType.Vacuum: {
				statements.vacuum.run();
				break;
			}
			case RequestType.SyncGuildChannelsAndRoles: {
				const timestamp = encodeTiming(req.timing);
				syncDeletions(objectStatements.channel, req.guildID, req.channelIDs, timestamp);
				syncDeletions(objectStatements.role, req.guildID, req.roleIDs, timestamp);
				break;
			}
			case RequestType.AddUserSnapshot: {
				const user = encodeObject(ObjectType.User, req.user);
				user.discriminator = req.user.discriminator === "0" ? null : req.user.discriminator;
				response = addSnapshot(objectStatements.user, assignTiming(user, req.timing));
				break;
			}
			case RequestType.AddGuildSnapshot: {
				response = addSnapshot(objectStatements.guild, assignTiming(encodeObject(ObjectType.Guild, req.guild), req.timing));
				break;
			}
			case RequestType.AddRoleSnapshot: {
				const role = encodeObject(ObjectType.Role, req.role);
				role._guild_id = req.guildID;
				response = addSnapshot(objectStatements.role, assignTiming(role, req.timing));
				break;
			}
			case RequestType.MarkRoleAsDeleted: {
				objectStatements.role.markAsDeleted.run({
					id: req.id,
					_deleted: encodeTiming(req.timing),
				});
				response = getChanges() > 0;
				break;
			}
			case RequestType.SyncGuildMembers: {
				const timestamp = encodeTiming(req.timing);
				const stored = objectStatements.member.getNotLeftUserIDsByGuildID.all({ _guild_id: req.guildID }) as any[];
				const sqlParams = {
					_guild_id: req.guildID,
					_user_id: 0n,
					_timestamp: timestamp,
					nick: null,
					avatar: null,
					roles: null,
					joined_at: null,
					premium_since: null,
					pending: null,
					communication_disabled_until: null,
				};
				for (const { _user_id: userID } of stored) {
					if (!req.userIDs.has(userID)) {
						sqlParams._user_id = userID;
						addSnapshot(objectStatements.member, sqlParams);
					}
				}
				break;
			}
			case RequestType.AddMemberSnapshot: {
				response = addSnapshot(objectStatements.member, Object.assign(assignTiming(encodeObject(ObjectType.Member, req.member), req.timing), {
					_guild_id: BigInt(req.guildID),
					_user_id: BigInt(req.userID),
				}), req.partial);
				break;
			}
			case RequestType.AddMemberLeave: {
				response = addSnapshot(objectStatements.member, assignTiming({
					_guild_id: BigInt(req.guildID),
					_user_id: BigInt(req.userID),
					nick: null,
					avatar: null,
					roles: null,
					joined_at: null,
					premium_since: null,
					pending: null,
					communication_disabled_until: null,
				}, req.timing));
				break;
			}
			case RequestType.AddChannelSnapshot: {
				const timestamp = encodeTiming(req.timing);
				if (req.channel.type === DT.ChannelType.GuildForum || req.channel.type === DT.ChannelType.GuildMedia) {
					for (const jsonTag of req.channel.available_tags) {
						const tag = encodeObject(ObjectType.ForumTag, jsonTag);
						tag.channel_id = req.channel.id;
						tag.emoji = encodeEmojiProps(jsonTag as DiscordEmojiProps);
						tag._timestamp = timestamp;
						addSnapshot(objectStatements.forumTag, tag);
					}
					syncDeletions(
						objectStatements.forumTag,
						BigInt(req.channel.id),
						new Set(req.channel.available_tags.map(t => BigInt(t.id))),
						timestamp,
					);
				}

				const channel = encodeObject(ObjectType.Channel, req.channel);
				if (req.channel.type === DT.ChannelType.DM || req.channel.type === DT.ChannelType.GroupDM) {
					channel.guild_id = 0;
				} else if (req.channel.type === DT.ChannelType.PublicThread || req.channel.type === DT.ChannelType.PrivateThread || req.channel.type === DT.ChannelType.AnnouncementThread) {
					channel.guild_id = null;
				}
				channel.permission_overwrites = (req.channel as any).permission_overwrites == null ? null : encodePermissionOverwrites((req.channel as any).permission_overwrites);
				channel._timestamp = timestamp;
				response = addSnapshot(objectStatements.channel, channel);
				break;
			}
			case RequestType.MarkChannelAsDeleted: {
				objectStatements.channel.markAsDeleted.run({
					id: req.id,
					_deleted: encodeTiming(req.timing),
				});
				response = getChanges() > 0;
				break;
			}
			case RequestType.AddMessageSnapshot: {
				const msg = encodeObject(ObjectType.Message, req.message);
				msg._attachment_ids = encodeSnowflakeArray((req.message.attachments).map(a => a.id));
				msg._sticker_ids =
					req.message.sticker_items == null || req.message.sticker_items.length === 0 ?
						new Uint8Array(0) :
						encodeSnowflakeArray(req.message.sticker_items.map(s => s.id));
				if (req.message.webhook_id == null) {
					msg.author__id = BigInt(req.message.author.id);
				} else {
					const webhookUser = {
						webhook_id: req.message.webhook_id,
						username: req.message.author.username,
						avatar: req.message.author.avatar == null ? null : encodeImageHash(req.message.author.avatar),
					};
					msg.author__id = (statements.findWebhookUserID.get(webhookUser) as any)?.internal_id ?? statements.addWebhookUser.run(webhookUser).lastInsertRowid;
				}
				if (req.message.message_reference == null) {
					msg.message_reference__message_id = null;
					msg.message_reference__channel_id = null;
					msg.message_reference__guild_id = null;
				} else {
					const isChannelIDRedundant =
						req.message.type === DT.MessageType.ChannelPinnedMessage || // same channel
						req.message.type === DT.MessageType.Reply || // same channel
						req.message.type === DT.MessageType.ThreadStarterMessage; // parent channel
					const isGuildIDRedundant =
						isChannelIDRedundant ||
						req.message.type === DT.MessageType.ThreadCreated; // same guild

					msg.message_reference__message_id = req.message.message_reference.message_id;
					msg.message_reference__channel_id = isChannelIDRedundant ? null : req.message.message_reference.channel_id;
					msg.message_reference__guild_id = isGuildIDRedundant ? null : req.message.message_reference.guild_id;
				}
				msg.interaction__user__id = req.message.interaction?.user.id;

				// Sometimes, when a message contains links, Discord will send a MESSAGE_CREATE
				// event without embeds and, after fetching the page and loading the embed, a
				// MESSAGE_UPDATE event with the embeds. Since this doesn't count as an edit,
				// `edited_timestamp` is not updated (except for sub-millisecond digits, which are set
				// to 0, but we ignore those anyway). If a message is edited by the user before the
				// embeds load, two update events are received: one for the edit the user made,
				// containing the new content, and a new `edited_timestamp`; and another one
				// afterwards, when the embed loads, with the original `embed_timestamp`, the original
				// content, and the respective embed. If the same message is fetched using the REST API
				// after the embed loads, the response has the new content, the new `edited_timestamp`,
				// but the embeds for the original content, which does not match the latest
				// MESSAGE_UPDATE event. It's even possible for a user with an official Discord client
				// to send a message with an embed but no links by editing out the link before the
				// embed loads. In these cases, we add the embeds to the latest snapshot instead of
				// saving a new snapshot.
				msg._timestamp = iso8601ToNumber(req.message.edited_timestamp);
				const snapshot: any = objectStatements.message.getLatestSnapshot.get({
					$getAll: 0,
					id: req.message.id,
				});
				if (snapshot === undefined) {
					// No recorded snapshots (message created or edited)
					objectStatements.message.addLatestSnapshot.run(msg);
					response = AddSnapshotResult.AddedFirstSnapshot;
				} else if (msg._timestamp <= snapshot._timestamp) {
					// Embed loaded (described above)
					log?.verbose?.(`Updated embed for message with ID ${msg.id}.`);
					snapshot.embeds = JSON.stringify(req.message.embeds);
					objectStatements.message.replaceLatestSnapshot.run(snapshot);
					response = AddSnapshotResult.SameAsLatest;
				} else {
					// Message edited normally
					msg.embeds = JSON.stringify(req.message.embeds);
					objectStatements.message.copyLatestSnapshot.run(msg);
					objectStatements.message.replaceLatestSnapshot.run(msg);
					response = AddSnapshotResult.AddedAnotherSnapshot;
				}

				for (const attachment of req.message.attachments) {
					const encoded = encodeObject(ObjectType.Attachment, attachment);
					encoded._message_id = req.message.id;
					statements.addAttachment.run(encoded);
				}
				break;
			}
			case RequestType.MarkMessageAsDeleted: {
				objectStatements.message.markAsDeleted.run({
					id: req.id,
					_deleted: encodeTiming(req.timing),
				});
				response = getChanges() > 0;
				break;
			}

			case RequestType.AddInitialReactions: {
				const emoji = encodeEmoji(req.emoji);
				if (req.emoji.id) {
					statements.addReactionEmoji.run({
						id: req.emoji.id,
						name: req.emoji.name,
						animated: req.emoji.animated ? 1n : 0n,
					});
				}
				for (const userID of req.userIDs) {
					statements.addReactionPlacement.run({
						message_id: req.messageID,
						emoji,
						type: req.reactionType,
						user_id: userID,
						start: 0n,
					});
				}
				break;
			}
			case RequestType.AddReactionPlacement: {
				const emoji = encodeEmoji(req.emoji);
				if (statements.checkForReaction.get({
					message_id: req.messageID,
					emoji,
					type: req.reactionType,
					user_id: req.userID,
				}) === undefined) {
					try {
						statements.addReactionPlacement.run({
							message_id: req.messageID,
							emoji,
							type: req.reactionType,
							user_id: req.userID,
							start: encodeTiming(req.timing),
						});
					} catch (err) {
						if (!(err instanceof SqliteError && err.code === "SQLITE_CONSTRAINT_FOREIGNKEY")) {
							throw err;
						}
					}
				}
				break;
			}
			case RequestType.MarkReactionAsRemoved: {
				statements.markReactionAsRemoved.run({
					message_id: req.messageID,
					emoji: encodeEmoji(req.emoji),
					type: req.reactionType,
					user_id: req.userID,
					end: encodeTiming(req.timing),
				});
				break;
			}
			case RequestType.MarkReactionsAsRemovedBulk: {
				if (req.emoji === null) {
					statements.markReactionsAsRemovedByMessage.run({
						message_id: req.messageID,
						end: encodeTiming(req.timing),
					});
				} else {
					statements.markReactionsAsRemovedByMessage.run({
						message_id: req.messageID,
						emoji: encodeEmoji(req.emoji),
						end: encodeTiming(req.timing),
					});
				}
				break;
			}

			case RequestType.GetFileHashUtilization: {
				response = statements.findFileByHash.get({
					content_hash: req.hash,
				}) != undefined;
				break;
			}
			case RequestType.AddFile: {
				statements.addFile.run({
					url: req.url,
					content_hash: req.hash,
					error_code: req.errorCode,
				});
				break;
			}

			case RequestType.GetLastMessageID: {
				response = (statements.getLastMessageID.get({
					channel_id: req.channelID,
				}) as any)["max(id)"];
				break;
			}

			case RequestType.GetGuilds: {
				response = mapIterator(objectStatements.guild.getLatestSnapshot.iterate({ id: 0, $getAll: 1 }) as IterableIterator<any>, (snapshot) => ({
					timing: decodeTiming(snapshot._timestamp),
					deletedTiming: decodeTiming(snapshot._deleted),
					guild: decodeObject(ObjectType.Guild, snapshot),
				}));
				break;
			}
			case RequestType.GetDMChannels: {
				response = mapIterator(objectStatements.channel.getLatestSnapshotsByParentID.iterate({
					$parentID: 0n,
				}) as IterableIterator<any>, (snapshot) => {
					const channel = decodeObject(ObjectType.Channel, snapshot);
					channel.guild_id = undefined;
					channel.permission_overwrites = snapshot.permission_overwrites === null ? null : decodePermissionOverwrites(snapshot.permission_overwrites);
					return {
						timing: decodeTiming(snapshot._timestamp),
						deletedTiming: decodeTiming(snapshot._deleted),
						channel,
					} satisfies IteratorResponseFor<GetDMChannelsRequest>;
				});
				break;
			}
			case RequestType.GetGuildChannels: {
				response = mapIterator(objectStatements.channel.getLatestSnapshotsByParentID.iterate({
					$parentID: req.guildID,
				}) as IterableIterator<any>, (snapshot) => {
					const channel = decodeObject(ObjectType.Channel, snapshot);
					channel.guild_id = req.guildID;
					channel.permission_overwrites = snapshot.permission_overwrites === null ? null : decodePermissionOverwrites(snapshot.permission_overwrites);
					return {
						timing: decodeTiming(snapshot._timestamp),
						deletedTiming: decodeTiming(snapshot._deleted),
						channel,
					} satisfies IteratorResponseFor<GetGuildChannelsRequest>;
				});
				break;
			}
			case RequestType.CountChannelMessages: {
				response = (objectStatements.message.countObjectsByParentID.get({
					$parentID: req.channelID,
				}) as any)["count(*)"];
				break;
			}
			case RequestType.GetChannelMessages: {
				response = mapIterator(objectStatements.message.getLatestSnapshotsWithWHUsersByParentID.iterate({
					$parentID: req.channelID,
				}) as IterableIterator<any>, (snapshot) => {
					const message = decodeObject(ObjectType.Message, snapshot);
					message.edited_timestamp = numberToISO8601(message.edited_timestamp);
					if (message.author__id < SNOWFLAKE_LOWER_BOUND) {
						const webhookUser: any = statements.getWebhookUser.get({ internal_id: message.author__id });
						message.webhook_id = webhookUser.webhook_id;
						message.author = {
							id: webhookUser.webhook_id,
							username: webhookUser.username,
							avatar: webhookUser.avatar === null ? null : decodeImageHash(webhookUser.avatar),
							discriminator: "0000",
							public_flags: 0,
							flags: 0,
							bot: true,
						};
					} else {
						message.webhook_id = null;
						message.author = {
							id: message.author__id,
						};
					}
					return {
						timing: decodeTiming(snapshot._timestamp),
						deletedTiming: decodeTiming(snapshot._deleted),
						message,
					} satisfies IteratorResponseFor<GetChannelMessagesRequest>;
				});
				break;
			}
			case RequestType.SearchMessages: {
				response = objectStatements.message.search.iterate({
					$startDelimiter: req.startDelimiter,
					$endDelimiter: req.endDelimiter,
					$query: req.query,
				});
				break;
			}
			default: {
				// @ts-expect-error `req` should have type `never`
				throw new TypeError(`Unknown request type ${req.type}.`);
			}
		}
		return response;
	};
}
