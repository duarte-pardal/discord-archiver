/**
 * @fileoverview Actually connects to the database. The `better-sqlite3` connection is always sync.
 * This file can be imported directly for a sync interface or via `worker.ts` for an async one.
 */

// TODO: Add support for Bun's `bun:sqlite`?
import * as fs from "node:fs";
import * as DT from "../discord-api/types.js";
import { default as SQLite, Statement, SqliteError } from "better-sqlite3";
import { SingleRequest, SingleResponseFor, Timing, RequestType, IteratorRequest, IteratorResponseFor, AddSnapshotResult, ObjectSnapshotResponse } from "./types.js";
import { encodeSnowflakeArray, encodeObject, ObjectType, encodeImageHash, decodeObject, encodePermissionOverwrites, decodePermissionOverwrites, decodeImageHash, encodeEmoji, encodeEmojiProps, decodeEmojiProps, setLogger, decodeSnowflakeArray } from "./generic-encoding.js";
import { Logger } from "../util/log.js";
import { snowflakeToTimestamp } from "../discord-api/snowflake.js";
import { createOnceFunction } from "../util/once.js";

const SNOWFLAKE_LOWER_BOUND = 1n << 32n;
const MAX_INT64 = (1n << 63n) - 1n;

export type RequestHandler = {
	<R extends SingleRequest>(req: R): SingleResponseFor<R>;
	<R extends IteratorRequest>(req: R): IterableIterator<IteratorResponseFor<R>>;
	<R extends SingleRequest | IteratorRequest>(req: R):
	R extends SingleRequest ? SingleResponseFor<R> :
	R extends IteratorRequest ? IterableIterator<IteratorResponseFor<R>> :
	never;
};

export function getRequestHandler({ path, log }: { path: string; log?: Logger }): RequestHandler {
	setLogger(log);
	const logOnce = createOnceFunction(log);

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
		/** Gets the latest previous snapshot earlier than or at `_timestamp` for an object with a given `id` */
		getPreviousSnapshot: Statement;
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
	type ChildObjectStatements = ObjectStatements & {
		/** Gets the latest snapshot for all child objects of a given parent */
		getLatestSnapshotsByParentID: Statement;
		/** Gets the IDs of all non-deleted objects */
		getNotDeletedObjectIDsByParentID: Statement;
	};
	type DeletableChildObjectStatements = DeletableObjectStatements & ChildObjectStatements;

	function getStatements(objectName: string, parentIDName: null, snapshotKeys: string[], objectKeys: string[]): DeletableObjectStatements;
	function getStatements(objectName: string, parentIDName: string, snapshotKeys: string[], objectKeys: string[]): DeletableChildObjectStatements;
	function getStatements(objectName: string, parentIDName: string | null, snapshotKeys: string[], objectKeys: string[]): DeletableObjectStatements {
		snapshotKeys.push("_extra");
		const sk = snapshotKeys.join(", ");
		const sv = snapshotKeys.map(k => ":" + k).join(", ");
		const ok = objectKeys.map(k => k + ", ").join("");
		const ov = objectKeys.map(k => `:${k}, `).join("");
		const statements = {
			doesExist: db.prepare(`\
SELECT 1 FROM latest_${objectName}_snapshots WHERE id = :id;
`),
			getLatestSnapshot: db.prepare(`\
SELECT id, _deleted, ${ok} _timestamp, ${sk} FROM latest_${objectName}_snapshots WHERE :$getAll = 1 OR id = :id;
`),
			getPreviousSnapshot: db.prepare(`\
SELECT id, max(_timestamp), ${sk} FROM previous_${objectName}_snapshots WHERE id = :id AND _timestamp <= :_timestamp;
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
				getNotDeletedObjectIDsByParentID: db.prepare(`\
SELECT id FROM latest_${objectName}_snapshots WHERE ${parentIDName} IS :$parentID AND _deleted IS NULL;
`),
			} satisfies Omit<ChildObjectStatements, keyof ObjectStatements>);
		}
		return statements;
	}
	const statements = {
		beginTransaction: db.prepare("BEGIN;"),
		commitTransaction: db.prepare("COMMIT;"),
		rollbackTransaction: db.prepare("ROLLBACK;"),
		optimize: db.prepare("PRAGMA optimize;"),
		vacuum: db.prepare("VACUUM;"),
		getChanges: db.prepare("SELECT changes();"),

		findWebhookUserID: db.prepare("SELECT internal_id FROM webhook_users WHERE webhook_id IS :webhook_id AND username IS :username AND avatar IS :avatar;"),
		addWebhookUser: db.prepare("INSERT INTO webhook_users (webhook_id, username, avatar) VALUES (:webhook_id, :username, :avatar);"),
		getWebhookUser: db.prepare("SELECT webhook_id, username, avatar FROM webhook_users WHERE internal_id = :internal_id;"),

		addAttachment: db.prepare("INSERT OR IGNORE INTO attachments (id, _extra, _message_id, filename, title, description, content_type, original_content_type, size, height, width, ephemeral, duration_secs, waveform, flags) VALUES (:id, :_extra, :_message_id, :filename, :title, :description, :content_type, :original_content_type, :size, :height, :width, :ephemeral, :duration_secs, :waveform, :flags);"),
		getAttachment: db.prepare("SELECT id, _extra, _message_id, filename, title, description, content_type, original_content_type, size, height, width, ephemeral, duration_secs, waveform, flags FROM attachments WHERE id = :id;"),

		addReactionEmoji: db.prepare("INSERT OR IGNORE INTO reaction_emojis (id, name, animated) VALUES (:id, :name, :animated);"),
		addReactionPlacement: db.prepare("INSERT INTO reactions (message_id, emoji, type, user_id, start, end) VALUES (:message_id, :emoji, :type, :user_id, :start, NULL);"),
		markReactionAsRemoved: db.prepare("UPDATE reactions SET end = :end WHERE message_id IS :message_id AND emoji IS :emoji AND type IS :type AND user_id IS :user_id AND end IS NULL;"),
		markReactionsAsRemovedByMessage: db.prepare("UPDATE reactions SET end = :end WHERE message_id IS :message_id AND end IS NULL;"),
		markReactionsAsRemovedByMessageAndEmoji: db.prepare("UPDATE reactions SET end = :end WHERE message_id IS :message_id AND emoji IS :emoji AND end IS NULL;"),
		checkForReaction: db.prepare("SELECT 1 FROM reactions WHERE message_id IS :message_id AND emoji IS :emoji AND type IS :type AND user_id IS :user_id AND end IS NULL;"),

		getFile: db.prepare("SELECT url, content_hash, error_code FROM files WHERE :$getAll = 1 OR url IS :url;"),
		findFileByHash: db.prepare("SELECT url FROM files WHERE content_hash IS :content_hash;"),
		addFile: db.prepare("INSERT OR IGNORE INTO files (url, content_hash, error_code) VALUES (:url, :content_hash, :error_code);"),

		getLastMessageID: db.prepare("SELECT max(id) FROM latest_message_snapshots WHERE channel_id = :channel_id;"),
	} as const;
	const objectStatements = {
		user: getStatements("user", null, ["username", "discriminator", "global_name", "avatar", "avatar_decoration_data__asset", "avatar_decoration_data__sku_id", "avatar_decoration_data__expires_at", "collectibles__nameplate__asset", "collectibles__nameplate__sku_id", "collectibles__nameplate__label", "collectibles__nameplate__palette", "collectibles__nameplate__expires_at", "display_name_styles__font_id", "display_name_styles__effect_id", "display_name_styles__colors", "primary_guild__identity_guild_id", "primary_guild__identity_enabled", "primary_guild__tag", "primary_guild__badge", "public_flags"], ["bot", "system"]),
		guild: getStatements("guild", null, ["name", "icon", "splash", "discovery_splash", "owner_id", "afk_channel_id", "afk_timeout", "widget_enabled", "widget_channel_id", "verification_level", "default_message_notifications", "explicit_content_filter", "mfa_level", "system_channel_id", "system_channel_flags", "rules_channel_id", "max_presences", "max_members", "vanity_url_code", "description", "banner", "premium_tier", "premium_subscription_count", "preferred_locale", "public_updates_channel_id", "max_video_channel_users", "max_stage_video_channel_users", "nsfw_level", "premium_progress_bar_enabled", "profile__tag", "profile__badge"], []),
		role: getStatements("role", "_guild_id", ["name", "colors__primary_color", "colors__secondary_color", "colors__tertiary_color", "hoist", "icon", "unicode_emoji", "position", "permissions", "mentionable", "flags", "tags__integration_id", "tags__subscription_listing_id", "tags__available_for_purchase", "tags__guild_connections"], ["_guild_id", "managed", "tags__bot_id", "tags__premium_subscriber"]),
		member: (() => {
			const snapshotKeys = ["_extra", "nick", "avatar", "avatar_decoration_data__asset", "avatar_decoration_data__sku_id", "avatar_decoration_data__expires_at", "collectibles__nameplate__asset", "collectibles__nameplate__sku_id", "collectibles__nameplate__label", "collectibles__nameplate__palette", "collectibles__nameplate__expires_at", "banner", "roles", "joined_at", "premium_since", "deaf", "mute", "flags", "pending", "communication_disabled_until"];
			const sk = snapshotKeys.join(", ");
			const sv = snapshotKeys.map(k => ":" + k).join(", ");
			return {
				doesExist: db.prepare(`\
SELECT 1 FROM member_snapshots WHERE _guild_id = :_guild_id AND _user_id = :_user_id;
`),
				getLatestSnapshot: db.prepare(`\
SELECT _guild_id, _user_id, max(_timestamp) AS _timestamp, ${sk} FROM member_snapshots WHERE _guild_id = :_guild_id AND _user_id = :_user_id;
`),
				getPreviousSnapshot: db.prepare(`\
SELECT _guild_id, _user_id, max(_timestamp), ${sk} FROM member_snapshots WHERE _guild_id = :_guild_id AND _user_id = :_user_id AND _timestamp <= :_timestamp;
`),
				isLatestSnapshotEqual: db.prepare(`
SELECT 1 FROM member_snapshots WHERE _guild_id = :_guild_id AND _user_id = :_user_id AND _timestamp = (SELECT max(_timestamp) FROM member_snapshots WHERE _guild_id = :_guild_id AND _user_id = :_user_id) AND ${snapshotKeys.map(k => `${k} IS :${k}`).join(" AND ")};
`),
				getLatestTimestamp: db.prepare(`\
SELECT max(_timestamp) AS _timestamp FROM member_snapshots WHERE _guild_id = :_guild_id AND _user_id = :_user_id;
`),
				addLatestSnapshot: db.prepare(`\
INSERT INTO member_snapshots (_guild_id, _user_id, _timestamp, ${sk})
VALUES (:_guild_id, :_user_id, :_timestamp, ${sv});
`),
				copyLatestSnapshot: db.prepare(`\
SELECT 0 WHERE FALSE;
`),
				replaceLatestSnapshot: db.prepare(`\
INSERT INTO member_snapshots (_guild_id, _user_id, _timestamp, ${sk})
VALUES (:_guild_id, :_user_id, :_timestamp, ${sv});
`),
				getLatestSnapshotsByParentID: db.prepare(`\
SELECT _guild_id, _user_id, _timestamp, ${sk} FROM member_snapshots WHERE _guild_id IS :$parentID AND _timestamp = (SELECT max(_timestamp) FROM member_snapshots subquery WHERE subquery._guild_id = :$parentID AND subquery._user_id = member_snapshots._user_id);
`),
				getNotDeletedObjectIDsByParentID: db.prepare(`\
SELECT _user_id AS id FROM member_snapshots WHERE _guild_id IS :$parentID AND _timestamp = (SELECT max(_timestamp) FROM member_snapshots subquery WHERE subquery._guild_id = :$parentID AND subquery._user_id = member_snapshots._user_id);
`),
			};
		})(),
		channel: getStatements("channel", "guild_id", ["position", "permission_overwrites", "name", "topic", "nsfw", "bitrate", "user_limit", "rate_limit_per_user", "icon", "owner_id", "parent_id", "rtc_region", "video_quality_mode", "default_auto_archive_duration", "flags", "default_reaction_emoji", "default_thread_rate_limit_per_user", "default_sort_order", "default_forum_layout", "default_tag_setting"], ["guild_id", "type"]),
		thread: getStatements("thread", "parent_id", ["name", "rate_limit_per_user", "owner_id", "thread_metadata__archived", "thread_metadata__auto_archive_duration", "thread_metadata__archive_timestamp", "thread_metadata__locked", "thread_metadata__invitable", "thread_metadata__create_timestamp", "flags", "applied_tags"], ["parent_id", "type"]),
		forumTag: getStatements("forum_tag", "channel_id", ["name", "moderated", "emoji"], ["channel_id"]),
		message: {
			...getStatements("message", "channel_id", ["content", "flags", "_attachment_ids"], ["channel_id", "author__id", "tts", "type", "message_reference__message_id", "message_reference__channel_id", "message_reference__guild_id", "_sticker_ids"]),
			search: db.prepare(`\
SELECT
	latest_message_snapshots._timestamp, latest_message_snapshots._deleted,
	latest_message_snapshots.id, highlight(message_fts_index, 0, :$startDelimiter, :$endDelimiter) AS content, latest_message_snapshots.flags,
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
		guildEmoji: {
			...getStatements("guild_emoji", "_guild_id", ["name", "roles"], ["_guild_id", "user__id", "require_colons", "managed", "animated"]),
			setUploader: db.prepare(`\
UPDATE latest_guild_emoji_snapshots SET user__id = :user__id WHERE id = :id;
`),
			checkForMissingUploaders: db.prepare(`
SELECT 1 FROM latest_guild_emoji_snapshots WHERE _deleted IS NULL AND user__id IS NULL;
`),
		},
	} as const;

	const nullMember = {
		_guild_id: 0n, // will be replaced when used
		_user_id: 0n, // will be replaced when used
		_timestamp: 0n, // will be replaced when used
		_extra: null,
		nick: null,
		avatar: null,
		avatar_decoration_data__asset: null,
		avatar_decoration_data__sku_id: null,
		avatar_decoration_data__expires_at: null,
		collectibles__nameplate__asset: null,
		collectibles__nameplate__sku_id: null,
		collectibles__nameplate__label: null,
		collectibles__nameplate__palette: null,
		collectibles__nameplate__expires_at: null,
		banner: null,
		roles: null,
		joined_at: null,
		premium_since: null,
		deaf: null,
		mute: null,
		flags: 0n,
		pending: 0n,
		communication_disabled_until: null,
	};


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
	 * @param partialKeys If not nullish, get the properties missing in `object` from the latest
	 * recorded snapshot or, if there are no snapshots, from `partialDefault`.
	 * @param checkIfChanged If `true`, prevent recording a snapshot that is equal to the latest snapshot
	 */
	function addSnapshot(statements: ObjectStatements, object: any, partialKeys?: string[], checkIfChanged = true): AddSnapshotResult {
		if (partialKeys != null) {
			// `object` has fields missing. Add the missing fields from the last snapshot.
			object.$getAll = 0;
			const oldObject: any = statements.getLatestSnapshot.get(object);
			if (oldObject === undefined || oldObject._timestamp === null) {
				try {
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
			for (const key of partialKeys) {
				object[key] ??= oldObject[key];
			}
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
	function syncDeletions(statements: DeletableChildObjectStatements, parentID: bigint, ids: Set<bigint>, timestamp: bigint) {
		const stored = statements.getNotDeletedObjectIDsByParentID.all({ $parentID: parentID }) as any[];
		for (const { id } of stored) {
			if (!ids.has(id)) {
				statements.markAsDeleted.run({ id, _deleted: timestamp });
			}
		}
	}

	/** Gets the snapshot corresponding to the specified timestamp for a given object. */
	function getObjectSnapshot<T>(
		statements: ObjectStatements,
		id: bigint | string,
		timestamp: number | null | undefined,
		decode: (snapshot: any) => T,
	): ObjectSnapshotResponse<T> | undefined {
		const timing = timestamp == null ? MAX_INT64 : (BigInt(timestamp) << 1n | 1n);
		const snapshot: any = statements.getLatestSnapshot.get({
			id,
			$getAll: 0n,
		});
		if (snapshot === undefined) {
			// There are no snapshots for this object.
			return undefined;
		}
		if (snapshot._timestamp > timing) {
			const previousPartialSnapshot: any = statements.getPreviousSnapshot.get({ id: snapshot.id, _timestamp: timing });
			previousPartialSnapshot._timestamp = previousPartialSnapshot["max(_timestamp)"];
			if (previousPartialSnapshot._timestamp == null) {
				// There are no snapshots archived before `timestamp`.
				return undefined;
			}
			Object.assign(snapshot, previousPartialSnapshot);
		}
		return {
			timing: decodeTiming(snapshot._timestamp),
			deletedTiming: decodeTiming(snapshot._deleted),
			data: decode(snapshot),
		};
	}

	function getDeletedObjectTiming(snapshot: any) {
		return decodeTiming(snapshot._deleted);
	}
	/**
	 * Gets a snapshot corresponding to the specified timestamp for each child of an object.
	 * @param timestamp The moment in time the returned snapshots are for. If nullish, the latest snapshots are returned.
	 * @param decode A function to decode the data as stored in the SQL table.
	 */
	function getChildrenSnapshot<T>(
		statements: ChildObjectStatements,
		parentID: bigint | string | null,
		timestamp: number | null | undefined,
		decode: (snapshot: any) => T,
		getDeletedTiming: (snapshot: any) => Timing | null = getDeletedObjectTiming,
	): IterableIterator<ObjectSnapshotResponse<T>> {
		const timing = timestamp == null ? MAX_INT64 : (BigInt(timestamp) << 1n | 1n);
		return (function* () {
			for (const result of statements.getLatestSnapshotsByParentID.iterate({
				$parentID: parentID,
			})) {
				const snapshot: any = result;
				if (snapshot._timestamp > timing) {
					const previousPartialSnapshot: any = statements.getPreviousSnapshot.get({ id: snapshot.id, _timestamp: timing });
					previousPartialSnapshot._timestamp = previousPartialSnapshot["max(_timestamp)"];
					if (previousPartialSnapshot._timestamp == null) {
						// There are no snapshots archived before `timestamp`.
						continue;
					}
					Object.assign(snapshot, previousPartialSnapshot);
				}
				yield {
					timing: decodeTiming(snapshot._timestamp),
					deletedTiming: getDeletedTiming(snapshot),
					data: decode(snapshot),
				};
			}
		})();
	}

	function getChanges(): bigint {
		return (statements.getChanges.get() as any)["changes()"];
	}


	let cachedChannelID: string;
	let cachedChannelParentID: string;
	let cachedChannelGuildID: string;
	function updateCachedChannel(channelID: string) {
		const channel: any = objectStatements.channel.getLatestSnapshot.get({ id: channelID, $getAll: 0n });
		cachedChannelID = String(channel.id);
		cachedChannelParentID = channel.parent_id === null ? null : channel.parent_id;
		cachedChannelGuildID = channel.guild_id === null ? null : channel.guild_id;
	}

	function decodeUser(snapshot: any): DT.PartialUser {
		const user = decodeObject(ObjectType.User, snapshot);
		user.discriminator = snapshot.discriminator === null ? "0" : snapshot.discriminator;
		user.flags = user.public_flags;
		if (
			user.primary_guild.identity_guild_id === null &&
			user.primary_guild.identity_enabled === null &&
			user.primary_guild.tag === null &&
			user.primary_guild.badge === null &&
			Object.keys(user.primary_guild).length === 4
		) {
			user.primary_guild = null;
		}
		if (
			user.collectibles.nameplate == null &&
			Object.keys(user.collectibles).length === 1
		) {
			user.collectibles = null;
		}
		user.clan = user.primary_guild;
		return user;
	}

	function decodeMessage(snapshot: any, timestamp: number | null | undefined, channelID: string, includeReferencedMessage: boolean) {
		const message: DT.Message = decodeObject(ObjectType.Message, snapshot);
		message.edited_timestamp = snapshot._timestamp === 0n ? null : (new Date(Number(snapshot._timestamp >> 1n)).toISOString());
		message.timestamp = new Date(Number(snowflakeToTimestamp(snapshot.id))).toISOString();
		message.pinned = false;

		// Can be computed from the message content but it's irrelevant for now.
		message.mentions = [];
		message.mention_roles = [];
		message.mention_everyone = false;

		if (BigInt(snapshot.author__id) < SNOWFLAKE_LOWER_BOUND) {
			const webhookUser: any = statements.getWebhookUser.get({ internal_id: snapshot.author__id });
			message.webhook_id = String(webhookUser.webhook_id);
			message.author = {
				id: String(webhookUser.webhook_id),
				username: webhookUser.username,
				avatar: webhookUser.avatar === null ? null : decodeImageHash(webhookUser.avatar),
				discriminator: "0000",
				public_flags: 0,
				flags: 0,
				bot: true,
				global_name: null,
				primary_guild: null,
				clan: null,
			};
		} else {
			delete message.webhook_id;
			message.author = getObjectSnapshot(objectStatements.user, snapshot.author__id, timestamp, decodeUser)!.data;
		}

		message.attachments = [];
		for (const id of decodeSnowflakeArray(snapshot._attachment_ids)) {
			const attachmentSnapshot = statements.getAttachment.get({ id });
			message.attachments.push(decodeObject(ObjectType.Attachment, attachmentSnapshot));
		}

		if (
			snapshot.message_reference__message_id !== null ||
			snapshot.message_reference__channel_id !== null ||
			snapshot.message_reference__guild_id !== null
		) {
			message.message_reference = {
				type: (message.flags! & DT.MessageFlag.HasSnapshot) !== 0 ?
					DT.MessageReferenceType.Forward :
					DT.MessageReferenceType.Default,
			};

			if (snapshot.message_reference__message_id !== null) {
				message.message_reference.message_id = String(snapshot.message_reference__message_id);
			}

			if (snapshot.message_reference__channel_id === 0n) {
				message.message_reference.channel_id = channelID;
			} else if (snapshot.message_reference__channel_id === 1n) {
				if (cachedChannelID !== channelID) updateCachedChannel(channelID);
				message.message_reference.channel_id = cachedChannelParentID;
			} else if (snapshot.message_reference__channel_id !== null) {
				message.message_reference.channel_id = String(snapshot.message_reference__channel_id);
			}

			if (snapshot.message_reference__guild_id === 0n) {
				if (cachedChannelID !== channelID) updateCachedChannel(channelID);
				message.message_reference.guild_id = String(cachedChannelGuildID);
			} else if (snapshot.message_reference__guild_id !== null) {
				message.message_reference.guild_id = String(snapshot.message_reference__guild_id);
			}
		}

		if (
			includeReferencedMessage &&
			message.message_reference?.message_id != null &&
			message.message_reference.channel_id != null &&
			(
				message.type === DT.MessageType.Reply ||
				message.type === DT.MessageType.ThreadStarterMessage ||
				message.type === DT.MessageType.ContextMenuCommand
			)
		) {
			message.referenced_message = getObjectSnapshot(
				objectStatements.message,
				message.message_reference.message_id,
				timestamp,
				snapshot => decodeMessage(snapshot, timestamp, channelID, false),
			)?.data ?? null;
		}

		if (message.interaction_metadata != null) {
			message.interaction_metadata.user =
				getObjectSnapshot(objectStatements.user, message.interaction_metadata.user.id, timestamp, decodeUser)!.data;
			message.interaction = {
				id: message.interaction_metadata.id,
				name: message.interaction_metadata.name!,
				type: message.interaction_metadata.type,
				user: message.interaction_metadata.user,
			};
		}
		if (message.interaction_metadata?.target_user != null) {
			message.interaction_metadata.target_user =
				getObjectSnapshot(objectStatements.user, message.interaction_metadata.target_user.id, timestamp, decodeUser)!.data;
		}
		return message;
	}

	const requestHandler = (req: SingleRequest | IteratorRequest) => {
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
			case RequestType.RollbackTransaction: {
				statements.rollbackTransaction.run();
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
			case RequestType.SyncDeletedGuildSubObjects: {
				const timestamp = encodeTiming(req.timing);
				if (req.channelIDs !== undefined)
					syncDeletions(objectStatements.channel, req.guildID, req.channelIDs, timestamp);
				if (req.roleIDs !== undefined)
					syncDeletions(objectStatements.role, req.guildID, req.roleIDs, timestamp);
				if (req.emojiIDs !== undefined)
					syncDeletions(objectStatements.guildEmoji, req.guildID, req.emojiIDs, timestamp);
				break;
			}
			case RequestType.AddUserSnapshot: {
				if (req.user.flags != null && req.user.flags !== req.user.public_flags) {
					logOnce("flags !== public_flags")?.warning?.("There's an user object with `flags` is different from `public_flags`.");
				}

				// Sometimes, Discord sends a `primary_guild` object with all properties set to `null`
				// except for `identity_enabled`, which is set to `false`.
				if (
					req.user.primary_guild != null &&
					req.user.primary_guild.identity_guild_id == null &&
					!req.user.primary_guild.identity_enabled &&
					req.user.primary_guild.tag == null &&
					req.user.primary_guild.badge == null &&
					Object.keys(req.user.primary_guild).every(k =>
						k == "identity_guild_id" ||
						k == "identity_enabled" ||
						k == "tag" ||
						k == "badge",
					)
				) {
					req.user.primary_guild = null;
				}

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
			case RequestType.GetRoles: {
				response = getChildrenSnapshot(objectStatements.role, req.guildID, req.timestamp, (snapshot) => decodeObject(ObjectType.Role, snapshot));
				break;
			}
			case RequestType.SyncGuildMembers: {
				nullMember._guild_id = req.guildID;
				nullMember._timestamp = encodeTiming(req.timing);
				const stored = objectStatements.member.getNotDeletedObjectIDsByParentID.all({ $parentID: req.guildID }) as any[];
				for (const { id } of stored) {
					if (!req.userIDs.has(id)) {
						nullMember._user_id = id;
						addSnapshot(objectStatements.member, nullMember);
					}
				}
				break;
			}
			case RequestType.AddGuildMemberSnapshot: {
				if ((req.member.joined_at satisfies string as unknown) == null) {
					throw new TypeError("`joined_at` is missing on a member object.");
				}

				requestHandler({
					type: RequestType.AddUserSnapshot,
					user: req.member.user,
					timing: {
						timestamp: req.timing.timestamp,
						realtime: false,
					},
				});

				response = addSnapshot(objectStatements.member, Object.assign(assignTiming(encodeObject(ObjectType.Member, req.member), req.timing), {
					_guild_id: BigInt(req.guildID),
					_user_id: BigInt(req.member.user.id),
				}), ["deaf", "mute"]);
				break;
			}
			case RequestType.AddGuildMemberLeave: {
				nullMember._guild_id = BigInt(req.guildID);
				nullMember._user_id = BigInt(req.userID);
				nullMember._timestamp = encodeTiming(req.timing);
				response = addSnapshot(objectStatements.member, nullMember);
				break;
			}
			case RequestType.GetGuildMembers: {
				response = getChildrenSnapshot(
					objectStatements.member,
					req.guildID,
					req.timestamp,
					(snapshot) => {
						const member = decodeObject(ObjectType.Member, snapshot);
						if (
							member !== undefined &&
							member.collectibles.nameplate === null &&
							Object.keys(member.collectibles).length === 1
						) {
							member.collectibles = null;
						}
						const user = getObjectSnapshot(objectStatements.user, snapshot._user_id, req.timestamp, decodeUser)!.data;
						return member === undefined ?
							{ user } : // the member was not in the guild at the specified timestamp
							Object.assign(member, { user });
					},
					(snapshot) => snapshot.joined_at != null ? null : decodeTiming(snapshot._timestamp),
				);
				break;
			}
			case RequestType.AddChannelSnapshot: {
				const timestamp = encodeTiming(req.timing);

				const channel = encodeObject(ObjectType.Channel, req.channel);
				if (DT.isDirectChannel(req.channel)) {
					channel.guild_id = 0;
				} else if (DT.isThread(req.channel)) {
					channel.guild_id = null;
				}
				channel.permission_overwrites = (req.channel as any).permission_overwrites == null ? null : encodePermissionOverwrites((req.channel as any).permission_overwrites);
				channel._timestamp = timestamp;
				response = addSnapshot(objectStatements.channel, channel);

				if (req.channel.type === DT.ChannelType.GuildForum || req.channel.type === DT.ChannelType.GuildMedia) {
					for (const jsonTag of req.channel.available_tags) {
						const tag = encodeObject(ObjectType.ForumTag, jsonTag);
						tag.channel_id = req.channel.id;
						tag.emoji = encodeEmojiProps(jsonTag);
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
			case RequestType.AddThreadSnapshot: {
				const thread = encodeObject(ObjectType.Thread, req.thread);
				response = addSnapshot(objectStatements.thread, assignTiming(thread, req.timing));
				break;
			}
			case RequestType.MarkThreadAsDeleted: {
				objectStatements.thread.markAsDeleted.run({
					id: req.id,
					_deleted: encodeTiming(req.timing),
				});
				response = getChanges() > 0;
				break;
			}
			case RequestType.GetChannels: {
				response = getChildrenSnapshot(objectStatements.channel, req.guildID ?? null, req.timestamp, (snapshot) => {
					const channel = decodeObject(ObjectType.Channel, snapshot);
					channel.guild_id = req.guildID;
					channel.permission_overwrites = snapshot.permission_overwrites === null ? null : decodePermissionOverwrites(snapshot.permission_overwrites);
					return channel;
				});
				break;
			}
			case RequestType.GetThreads: {
				response = getChildrenSnapshot(objectStatements.thread, req.parentID, req.timestamp, (snapshot) => {
					const thread = decodeObject(ObjectType.Thread, snapshot);
					return thread;
				});
				break;
			}
			case RequestType.GetForumTags: {
				response = getChildrenSnapshot(objectStatements.forumTag, req.channelID, req.timestamp, (snapshot) =>
					Object.assign(decodeObject(ObjectType.ForumTag, snapshot), decodeEmojiProps(snapshot.emoji)),
				);
				break;
			}
			case RequestType.AddMessageSnapshot: {
				if (
					objectStatements.channel.doesExist.get({ id: req.message.channel_id }) === undefined &&
					objectStatements.thread.doesExist.get({ id: req.message.channel_id }) === undefined
				) {
					throw new Error("Can't add a message from a channel/thread that isn't in the database.");
				}

				for (const user of req.message.mentions) {
					requestHandler({
						type: RequestType.AddUserSnapshot,
						user,
						timing: {
							timestamp: req.timestamp,
							realtime: false,
						},
					});
				}
				// Replace user data with references to the users table.
				// Note: this mutates the original message object.
				if (req.message.interaction_metadata?.user != null) {
					requestHandler({
						type: RequestType.AddUserSnapshot,
						user: req.message.interaction_metadata.user,
						timing: {
							timestamp: req.timestamp,
							realtime: false,
						},
					});
					(req.message.interaction_metadata.user as any) = { id: req.message.interaction_metadata.user.id };
				}
				if (req.message.interaction_metadata?.target_user != null) {
					requestHandler({
						type: RequestType.AddUserSnapshot,
						user: req.message.interaction_metadata.target_user,
						timing: {
							timestamp: req.timestamp,
							realtime: false,
						},
					});
					(req.message.interaction_metadata.target_user as any) = { id: req.message.interaction_metadata.target_user.id };
				}

				const msg = encodeObject(ObjectType.Message, req.message);

				msg._attachment_ids = encodeSnowflakeArray((req.message.attachments).map(a => a.id));
				msg._sticker_ids =
					req.message.sticker_items == null || req.message.sticker_items.length === 0 ?
						new Uint8Array(0) :
						encodeSnowflakeArray(req.message.sticker_items.map(s => s.id));

				if (
					req.message.webhook_id == null ||
					req.message.webhook_id === req.message.application_id ||
					req.message.webhook_id === req.message.application?.id
				) {
					// The author is a regular user
					msg.author__id = BigInt(req.message.author.id);
					requestHandler({
						type: RequestType.AddUserSnapshot,
						user: req.message.author,
						timing: {
							timestamp: req.timestamp,
							realtime: false,
						},
					});
				} else {
					// The author is a webhook user (is stored alongside the message by Discord and may
					// have different versions with the same ID)
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
					if (
						msg.message_reference__channel_id != null ||
						msg.message_reference__guild_id != null
					) {
						updateCachedChannel(req.message.channel_id);
					}

					msg.message_reference__message_id = req.message.message_reference.message_id ?? null;
					msg.message_reference__channel_id =
						req.message.message_reference.channel_id == null ? null :
						req.message.message_reference.channel_id === cachedChannelID ? 0n :
						req.message.message_reference.channel_id === cachedChannelParentID ? 1n :
						req.message.message_reference.channel_id;
					msg.message_reference__guild_id =
						req.message.message_reference.guild_id == null ? null :
						req.message.message_reference.guild_id === cachedChannelGuildID ? 0n :
						req.message.message_reference.guild_id;
				}

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
				msg._timestamp = req.message.edited_timestamp == null ? 0 : (BigInt(new Date(req.message.edited_timestamp).getTime()) << 1n | 1n);
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

			case RequestType.GetFiles: {
				response = Iterator.prototype.map.call(statements.getFile.iterate({ $getAll: 1, url: null }) as IterableIterator<any>, (file) => ({
					url: file.url,
					hash: file.content_hash,
					errorCode: file.error_code,
				}));
				break;
			}
			case RequestType.GetFile: {
				const file = statements.getFile.get({
					$getAll: 0,
					url: req.url,
				}) as any;
				response = file === undefined ? undefined : {
					hash: file.content_hash,
					errorCode: file.error_code,
				};
				break;
			}
			case RequestType.GetFileHashUtilization: {
				response = statements.findFileByHash.get({
					content_hash: req.hash,
				}) !== undefined;
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

			case RequestType.AddGuildEmojiSnapshot: {
				const emoji = encodeObject(ObjectType.GuildEmoji, req.emoji);
				emoji._guild_id = req.guildID;
				// user__id is stored once per object, not once per snapshot, so it's not checked when
				// determining whether this should be a new snapshot.
				emoji.user__id = req.emoji.user?.id;
				response = addSnapshot(objectStatements.guildEmoji, assignTiming(emoji, req.timing));
				break;
			}
			case RequestType.MarkGuildEmojiAsDeleted: {
				objectStatements.guildEmoji.markAsDeleted.run({
					id: req.id,
					_deleted: encodeTiming(req.timing),
				});
				response = getChanges() > 0;
				break;
			}
			case RequestType.UpdateEmojiUploaders: {
				for (const emoji of req.emojis) {
					objectStatements.guildEmoji.setUploader.run(emoji);
				}
				break;
			}
			case RequestType.CheckForMissingEmojiUploaders: {
				response = objectStatements.guildEmoji.checkForMissingUploaders.get() !== undefined;
				break;
			}
			case RequestType.GetGuildEmojis: {
				response = getChildrenSnapshot(objectStatements.guildEmoji, req.guildID, req.timestamp, (snapshot) => {
					const emoji = decodeObject(ObjectType.GuildEmoji, snapshot);
					if (snapshot.user__id != null) {
						emoji.user = getObjectSnapshot(objectStatements.user, snapshot.user__id, req.timestamp, decodeUser)!.data;
					}
					return emoji;
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
				response = Iterator.prototype.map.call(objectStatements.guild.getLatestSnapshot.iterate({ id: 0, $getAll: 1 }) as IterableIterator<any>, (snapshot) => ({
					timing: decodeTiming(snapshot._timestamp),
					deletedTiming: decodeTiming(snapshot._deleted),
					data: decodeObject(ObjectType.Guild, snapshot),
				}));
				break;
			}
			case RequestType.GetMessages: {
				response = getChildrenSnapshot(objectStatements.message, req.channelID, req.timestamp, snapshot => decodeMessage(snapshot, req.timestamp, req.channelID, true));
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
				throw new TypeError(`Unknown request type ${(req satisfies never as any).type}.`);
			}
		}
		return response;
	};
	return requestHandler;
}
