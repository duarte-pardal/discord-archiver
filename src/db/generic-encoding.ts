/**
 * @fileoverview Handles the operations in the conversion from objects in the Discord API format to the database format and back that are common to all object types.
 *
 * Most of the conversion work is done here, with some operations specific to each object type being handled in `worker.ts`.
 */

import * as DT from "../discord-api/types.js";
import { Logger } from "../util/log.js";
import { createOnceFunction } from "../util/once.js";

export enum ObjectType {
	User,
	Guild,
	Role,
	Member,
	Channel,
	Message,
	Attachment,
	ForumTag,
	GuildEmoji,
}

type InputObjectType = {
	[ObjectType.User]: DT.PartialUser | DT.PartialUserWithMemberField | DT.User;
	[ObjectType.Guild]: DT.Guild | DT.GatewayGuildCreateDispatchPayload["d"];
	[ObjectType.Role]: DT.Role;
	[ObjectType.Member]: DT.GuildMember;
	[ObjectType.Channel]: DT.ChannelWithGuildID;
	[ObjectType.Message]: DT.Message | DT.GatewayMessageCreateDispatchPayload["d"];
	[ObjectType.Attachment]: DT.Attachment;
	[ObjectType.ForumTag]: DT.ForumTag;
	[ObjectType.GuildEmoji]: DT.CustomEmoji;
};
type KeyOfObject<OT extends ObjectType> = keyof InputObjectType[OT];

enum ValueType {
	String,
	Integer,
	/** Stored as an SQL `INTEGER` (0 or 1) and converted to a boolean */
	Boolean,
	/** Same as `Boolean` but converts `null` and `undefined` in the same way as `false` */
	StrictBoolean,
	/** Stored as an SQL `INTEGER` and converted to a string */
	BigInteger,
	Float,
	/** Stored as an SQL `BLOB` and encoded in base64 with padding */
	Base64,
	/** Stored in the custom image hash format and converted to a string */
	ImageHash,
	/** Stored as an SQL `BLOB` containing 64-bit big-endian integers and converted to an array of strings */
	BigIntegerArray,
	/** Stored as an SQL `INTEGER` containing the Unix timestamp in milliseconds and converted to a string containing the timestamp in the ISO 8601 extended format used by Discord */
	Timestamp,
	/** Either a custom or a built-in emoji, stored as an SQL `INTEGER` with the id of the custom emoji or as an SQL `TEXT` with the Unicode emoji and converted to an object of the type `DiscordEmoji` */
	Emoji,
	/** Arbitrary JSON value stored as SQL `TEXT` */
	JSON,
	/** Always stored as the SQL `INTEGER` 0 and always converted to `null` */
	Null,
}

enum NullValue {
	/** `NULL` or absence in the `_extra` field means that the property is not in the object */
	Absent,
	/** `NULL` or absence in the `_extra` field means that the value is `null` */
	Null,
	/** `NULL` or absence in the `_extra` field means that the value is `[]` */
	EmptyArray,
}

function getNullValue(value: NullValue | undefined) {
	if (value === undefined) {
		throw new TypeError("A required field was NULL");
	}
	switch (value) {
		case NullValue.Absent:
			return undefined;
		case NullValue.Null:
			return null;
		case NullValue.EmptyArray:
			return [];
	}
}

type AllKeysOf<T> = T extends T ? keyof T : never;
type Schema<O = Partial<Record<string, any>>> = [key: AllKeysOf<O>, type: ValueType | Schema | "ignore" | "extra", nullValue?: NullValue][];

const schemas: { [OT in ObjectType]: Schema<InputObjectType[OT]> } = {
	[ObjectType.User]: [
		["id", ValueType.BigInteger],
		["username", ValueType.String],
		["discriminator", "ignore"], // custom encoding
		["global_name", ValueType.String, NullValue.Null],
		["avatar", ValueType.ImageHash, NullValue.Null],
		["avatar_decoration_data", "ignore"], // not archived
		["collectibles", "ignore"], // not archived
		["display_name_styles", "ignore"], // not archived
		["clan", "ignore"], // not archived
		["primary_guild", "ignore"], // not archived
		["linked_users", "ignore"], // not archived
		["bot", ValueType.StrictBoolean],
		["system", ValueType.StrictBoolean],
		["pronouns", "ignore"], // not archived
		["bio", "ignore"], // not archived
		["banner", "ignore"], // not archived
		["banner_color", "ignore"], // not archived
		["accent_color", "ignore"], // not archived
		["flags", "ignore"], // not archived (should be equal to public_flags)
		["public_flags", ValueType.Integer, NullValue.Absent],
		["display_name", "ignore"], // not archived (undocumented)

		["member", "ignore"],
	],
	[ObjectType.Guild]: [
		["id", ValueType.BigInteger],
		["name", ValueType.String],
		["icon", ValueType.ImageHash, NullValue.Null],
		["splash", ValueType.ImageHash, NullValue.Null],
		["discovery_splash", ValueType.ImageHash, NullValue.Null],
		["owner", "ignore"], // archived separately
		["owner_id", ValueType.BigInteger, NullValue.Null],
		["permissions", "ignore"], // not archived
		["region", "ignore"], // not archived (deprecated)
		["afk_channel_id", ValueType.BigInteger, NullValue.Null],
		["afk_timeout", ValueType.Integer],
		["widget_enabled", ValueType.StrictBoolean],
		["widget_channel_id", ValueType.BigInteger, NullValue.Null],
		["verification_level", ValueType.Integer],
		["default_message_notifications", ValueType.Integer],
		["explicit_content_filter", ValueType.Integer],
		["roles", "ignore"], // archived separately
		["emojis", "ignore"], // archived separately
		["features", "ignore"], // not archived
		["mfa_level", ValueType.Integer],
		["application_id", "ignore"], // not archived
		["system_channel_id", ValueType.BigInteger, NullValue.Null],
		["system_channel_flags", ValueType.Integer],
		["rules_channel_id", ValueType.BigInteger, NullValue.Null],
		["max_presences", ValueType.Integer, NullValue.Null],
		["max_members", ValueType.Integer, NullValue.Null],
		["vanity_url_code", ValueType.String, NullValue.Null],
		["description", ValueType.String, NullValue.Null],
		["banner", ValueType.ImageHash, NullValue.Null],
		["premium_tier", ValueType.Integer],
		["premium_subscription_count", ValueType.Integer, NullValue.Absent],
		["preferred_locale", ValueType.String],
		["public_updates_channel_id", ValueType.BigInteger, NullValue.Null],
		["max_video_channel_users", ValueType.Integer, NullValue.Absent],
		["max_stage_video_channel_users", ValueType.Integer, NullValue.Absent],
		["approximate_member_count", "ignore"], // not archived
		["approximate_presence_count", "ignore"], // not archived
		["welcome_screen", "ignore"], // not archived
		["nsfw", "ignore"], // not archived
		["nsfw_level", ValueType.Integer],
		["stickers", "ignore"], // TODO: sticker support
		["premium_progress_bar_enabled", ValueType.StrictBoolean],
		["safety_alerts_channel_id", "ignore"], // not archived
		["incidents_data", "ignore"], // not archived
		["profile", [
			["tag", ValueType.String],
			["badge", ValueType.ImageHash],
		], NullValue.Null],

		// Extra fields on the `GUILD_CREATE` gateway payload
		["large", "ignore"], // not archived
		["unavailable", "ignore"], // not archived
		["member_count", "ignore"], // not archived
		["voice_states", "ignore"], // not archived
		["members", "ignore"], // archived separately
		["channels", "ignore"], // archived separately
		["threads", "ignore"], // archived separately
		["presences", "ignore"], // not archived
		["stage_instances", "ignore"], // not archived
		["guild_scheduled_events", "ignore"], // not archived
		["soundboard_sounds", "ignore"], // TODO: sticker support
		["joined_at", "ignore"], // not archived

		// Other undocumented ignored fields
		["moderator_reporting", "ignore"], // not archived
		["activity_instances", "ignore"], // not archived
		["hub_type", "ignore"], // not archived
		["latest_onboarding_question_id", "ignore"], // not archived
		["premium_features", "ignore"], // not archived
		["owner_configured_content_level", "ignore"], // not archived
		["embedded_activities", "ignore"], // not archived
		["lazy", "ignore"], // not archived
		["application_command_counts", "ignore"], // not archived
		["home_header", "ignore"], // not archived
		["version", "ignore"], // not archived
		["inventory_settings", "ignore"], // not archived
	],
	[ObjectType.Role]: [
		["id", ValueType.BigInteger],
		["name", ValueType.String],
		["description", "extra", NullValue.Absent], // experimental
		["color", "ignore"], // not archived (deprecated)
		["colors", [
			["primary_color", ValueType.Integer],
			["secondary_color", ValueType.Integer, NullValue.Null],
			["tertiary_color", ValueType.Integer, NullValue.Null],
		]],
		["hoist", ValueType.Boolean],
		["icon", ValueType.ImageHash, NullValue.Null],
		["unicode_emoji", ValueType.String, NullValue.Null],
		["position", ValueType.Integer],
		["permissions", ValueType.BigInteger],
		["managed", ValueType.Boolean],
		["mentionable", ValueType.Boolean],
		["tags", [
			["bot_id", ValueType.BigInteger, NullValue.Absent],
			["integration_id", ValueType.BigInteger, NullValue.Absent],
			["premium_subscriber", ValueType.Null, NullValue.Absent],
			["subscription_listing_id", ValueType.BigInteger, NullValue.Absent],
			["available_for_purchase", ValueType.Null, NullValue.Absent],
			["guild_connections", ValueType.Null, NullValue.Absent],
		], NullValue.Absent],
		["flags", ValueType.Integer],

		["version" as KeyOfObject<ObjectType.Role>, "ignore"], // not archived
	],
	[ObjectType.Member]: [
		["user", "ignore"], // archived separately
		["nick", ValueType.String, NullValue.Null],
		["avatar", ValueType.ImageHash, NullValue.Null],
		["banner", "ignore"], // not archived
		["roles", ValueType.BigIntegerArray],
		["joined_at", ValueType.Timestamp],
		["premium_since", ValueType.Timestamp, NullValue.Null],
		["deaf", "ignore"], // not archived
		["mute", "ignore"], // not archived
		["flags", ValueType.Integer],
		["pending", ValueType.StrictBoolean],
		["communication_disabled_until", ValueType.Timestamp, NullValue.Null],
		["unusual_dm_activity_until", "ignore"], // not archived
	],
	[ObjectType.Channel]: [
		// What the SQL `NULL` value should mean depends on the channel type. Currently, we always decode those to `null`. Namely:
		// If the channel is a group DM, `name` and `icon` are never absent but may be null; if not, they are always absent.
		// If the channel is a guild text or announcement channel, `topic` is never absent but may be null; if not, it is always absent.
		// If the channel is a voice channel, `rtc_region` is never absent but may be null; if not, it is always absent.
		// If the channel is a forum channel, `default_reaction_emoji` is never absent but may be null; if not, it is always absent.
		["id", ValueType.BigInteger],
		["type", ValueType.Integer],
		["guild_id", ValueType.BigInteger, NullValue.Absent],
		["position", ValueType.Integer, NullValue.Absent],
		["permission_overwrites", "ignore"],
		["name", ValueType.String, NullValue.Null],
		["topic", ValueType.String, NullValue.Null],
		["nsfw", ValueType.Boolean, NullValue.Absent],
		["last_message_id", "ignore"],
		["bitrate", ValueType.Integer, NullValue.Absent],
		["user_limit", ValueType.Integer, NullValue.Absent],
		["rate_limit_per_user", ValueType.Integer, NullValue.Absent],
		["recipients", "ignore"], // TODO: archive DM recipients
		["icon", ValueType.ImageHash, NullValue.Null],
		["owner_id", ValueType.BigInteger, NullValue.Absent],
		["application_id", "ignore"], // not archived
		["parent_id", ValueType.BigInteger, NullValue.Null],
		["last_pin_timestamp", "ignore"],
		["rtc_region", ValueType.String, NullValue.Null],
		["video_quality_mode", ValueType.Integer, NullValue.Absent],
		["message_count", "ignore"], // not archived
		["member_count", "ignore"], // not archived
		["thread_metadata", [
			["archived", ValueType.Boolean],
			["auto_archive_duration", ValueType.Integer],
			["archive_timestamp", ValueType.Timestamp],
			["locked", ValueType.Boolean],
			["invitable", ValueType.Boolean, NullValue.Absent],
			["create_timestamp", ValueType.Timestamp, NullValue.Absent],
		], NullValue.Absent],
		["member", "ignore"], // not archived
		["default_auto_archive_duration", ValueType.Integer, NullValue.Absent],
		["permissions", "ignore"], // not archived
		["flags", ValueType.Integer, NullValue.Absent],
		["total_message_sent", "ignore"], // not archived
		["available_tags", "ignore"], // not archived
		["applied_tags", ValueType.BigIntegerArray, NullValue.Absent],
		["default_reaction_emoji", ValueType.Emoji, NullValue.Null],
		["default_thread_rate_limit_per_user", ValueType.Integer, NullValue.Absent],
		["default_sort_order", ValueType.Integer, NullValue.Null],
		["default_forum_layout", ValueType.Integer, NullValue.Absent],
		["default_tag_setting", ValueType.String, NullValue.Absent],
		["icon_emoji", "ignore"], // not archived
		["theme_color", "ignore"], // not archived
		["status", "ignore"], // not archived
		["hd_streaming_until", "ignore"], // not archived
		["hd_streaming_buyer_id", "ignore"], // not archived
		["linked_lobby", "ignore"], // not archived
		["voice_background_display", "ignore"], // not archived
		["template", "ignore"], // not archived

		["version" as KeyOfObject<ObjectType.Channel>, "ignore"], // not archived
	],
	[ObjectType.Message]: [
		["id", ValueType.BigInteger],
		["channel_id", ValueType.BigInteger],
		["author", "ignore"], // archived separately
		["content", ValueType.String],
		["timestamp", "ignore"],
		["edited_timestamp", "ignore"],
		["tts", ValueType.Boolean],
		["mention_everyone", "ignore"], // not archived
		["mentions", "ignore"], // not archived
		["mention_roles", "ignore"], // not archived
		["mention_channels", "ignore"], // not archived
		["attachments", "ignore"],
		["embeds", "extra", NullValue.EmptyArray],
		["reactions", "ignore"], // archived separately
		["pinned", "ignore"],
		["webhook_id", "ignore"], // archived separately
		["type", ValueType.Integer],
		["activity", "extra", NullValue.Absent],
		["application", "extra", NullValue.Absent],
		["application_id", "extra", NullValue.Absent],
		["flags", ValueType.Integer],
		["message_reference", "ignore"], // custom encoding
		["message_snapshots", "extra", NullValue.Absent],
		["referenced_message", "ignore"], // archived separately
		["interaction_metadata", [
			["id", "extra", NullValue.Absent],
			["type", "extra"],
			["name", "extra", NullValue.Absent],
			["command_type", "extra", NullValue.Absent],
			["ephemerality_reason", "extra", NullValue.Absent],
			["user", "extra", NullValue.Absent], // archived separately (replaced by reference before encoding)
			["authorizing_integration_owners", "ignore"], // not archived
			["original_response_message_id", "extra", NullValue.Absent],
			["interacted_message_id", "extra", NullValue.Absent],
			["triggering_interaction_metadata", "ignore"], // not archived
			["target_user", "ignore"], // archived separately
			["target_message_id", "extra", NullValue.Absent],
		], NullValue.Absent],
		["interaction", "ignore"], // not archived (deprecated)
		["thread", "ignore"],
		["components", "extra", NullValue.EmptyArray],
		["sticker_items", "extra", NullValue.Absent], // TODO: sticker support
		["stickers", "ignore"],
		["position", "ignore"],
		["role_subscription_data", "extra", NullValue.Absent],
		["resolved", "ignore"],
		["poll", "extra", NullValue.Absent], // TODO: poll support
		["call", "extra", NullValue.Absent],
		["activity_instance", "ignore"], // not archived

		// Extra fields on gateway payloads
		["channel_type", "ignore"],
		["guild_id", "ignore"],
		["member", "ignore"],
		["metadata", "ignore"],
		["nonce", "ignore"],
	],
	[ObjectType.Attachment]: [
		["id", ValueType.BigInteger],
		["filename", ValueType.String],
		["title", ValueType.String, NullValue.Absent],
		["description", ValueType.String, NullValue.Absent],
		["content_type", ValueType.String, NullValue.Absent],
		["original_content_type", ValueType.String, NullValue.Absent],
		["size", ValueType.Integer],
		["url", "ignore"], // not archived
		["proxy_url", "ignore"], // not archived
		["height", ValueType.Integer, NullValue.Absent],
		["width", ValueType.Integer, NullValue.Absent],
		["content_scan_version", "ignore"], // not archived
		["placeholder_version", "ignore"], // not archived
		["placeholder", "ignore"], // not archived
		["ephemeral", ValueType.StrictBoolean],
		["duration_secs", ValueType.Float, NullValue.Absent],
		["waveform", ValueType.Base64, NullValue.Absent],
		["flags", ValueType.Integer, NullValue.Absent],
		["clip_created_at", "extra", NullValue.Absent],
		["clip_participants", "extra", NullValue.Absent],
		["application", "extra", NullValue.Absent],
	],
	[ObjectType.ForumTag]: [
		["id", ValueType.BigInteger],
		["name", ValueType.String],
		["moderated", ValueType.Boolean],
		["emoji_id", "ignore"], // custom encoding
		["emoji_name", "ignore"], // custom encoding
		["color", "ignore"], // not archived (experimental)

		["version" as KeyOfObject<ObjectType.ForumTag>, "ignore"], // not archived
	],
	[ObjectType.GuildEmoji]: [
		["id", ValueType.BigInteger],
		["require_colons", ValueType.StrictBoolean],
		["managed", ValueType.StrictBoolean],
		["animated", ValueType.StrictBoolean],

		["name", ValueType.String],
		["roles", ValueType.BigIntegerArray],

		["available", "ignore"],

		["version" as KeyOfObject<ObjectType.GuildEmoji>, "ignore"], // not archived
	],
};

type ProcessedSchema = {
	/** Properties that have a corresponding SQL column */
	properties: [key: string, type: ValueType | ProcessedSchema | "extra", nullValue?: NullValue][];
	knownKeys: Set<string>;
};
const processSchema = (schema: Schema): ProcessedSchema => ({
	properties: schema
		.filter((property): property is [string, ValueType | Schema | "extra", NullValue] => property[1] !== "ignore")
		.map(([key, type, nullValue]) => [key, typeof type === "object" ? processSchema(type) : type, nullValue]),
	knownKeys: new Set(schema.map(p => p[0])),
});
const processedSchemas = Object.fromEntries(
	Object.entries(schemas as unknown as Schema[])
		.map(([objectType, schema]) => [objectType, processSchema(schema)]),
);

// TODO: Avatar decoration hashes (v2_*)
// It is unknown if there will be a v3, v4, etc. and if the format will stay consistent
const IMAGE_HASH_REGEX = /^(a_)?([0-9a-f]{32})$/;
export function encodeImageHash(hash: string): Uint8Array | string {
	if (typeof hash !== "string")
		throw TypeError("Only strings can be encoded into the image hash representation");

	const match = IMAGE_HASH_REGEX.exec(hash) as [string, string | undefined, string] | null;
	if (match === null) {
		return hash;
	} else {
		const buf = new Uint8Array(17);
		buf[0] = Number(match[1] !== undefined) << 0;
		buf.set(Buffer.from(match[2], "hex"), 1);
		return buf;
	}
}
export function decodeImageHash(encodedHash: Uint8Array | string): string {
	if (typeof encodedHash === "string") {
		return encodedHash;
	}
	if (!(encodedHash instanceof Uint8Array))
		throw TypeError("Not an Uint8Array nor a string");
	if (encodedHash.byteLength !== 17)
		throw TypeError("Invalid size");

	let hash = "";

	if (encodedHash[0] & 1 << 0)
		hash += "a_";
	hash += Buffer.from(encodedHash.subarray(1)).toString("hex");
	return hash;
}

export function encodeSnowflakeArray(array: string[]): Uint8Array {
	const dv = new DataView(new ArrayBuffer(array.length * 8));
	for (let i = 0; i < array.length; i++)
		dv.setBigUint64(i * 8, BigInt(array[i]));
	return new Uint8Array(dv.buffer);
}
export function decodeSnowflakeArray(buf: Uint8Array): string[] {
	if (!(buf instanceof Uint8Array))
		throw TypeError("Not an Uint8Array.");
	if (buf.byteLength % 8 !== 0)
		throw TypeError("Size not a multiple of 8 bytes.");
	const length = buf.byteLength / 8;
	const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const array: string[] = [];
	for (let i = 0; i < length; i++)
		array[i] = String(dv.getBigUint64(i * 8));
	return array;
}

// I have observed some objects with both `emoji_id` and `emoji_name` being sent by the API.
// It probably isn't possible to create them with an unmodified client but it seems that the
// servers don't check that only one property is set.
export type DiscordEmojiProps = { emoji_id: string; emoji_name: null } | { emoji_id: null; emoji_name: string };
export function encodeEmojiProps(emoji: DiscordEmojiProps): bigint | string {
	return encodeEmoji({ id: emoji.emoji_id, name: emoji.emoji_name } as DT.PartialEmoji);
}
export function decodeEmojiProps(data: bigint | string): DiscordEmojiProps {
	if (typeof data === "bigint")
		return { emoji_id: String(data), emoji_name: null };
	else
		return { emoji_id: null, emoji_name: data };
}
export function encodeEmoji(emoji: DT.PartialEmoji): bigint | string {
	if (emoji.id != null)
		return BigInt(emoji.id);
	else
		return emoji.name;
}
export function decodeEmoji(data: bigint | string): DT.PartialEmoji {
	if (typeof data === "bigint")
		return { id: String(data), name: "" };
	else
		return { id: null, name: data };
}

export function encodePermissionOverwrites(overwrites: DT.PermissionOverwrite[]): Uint8Array {
	const dv = new DataView(new ArrayBuffer(overwrites.length * 25));
	for (let i = 0; i < overwrites.length; i++) {
		const overwrite = overwrites[i];
		const allow = BigInt(overwrite.allow);
		const deny = BigInt(overwrite.deny);
		if (allow >= 1n << 64n || deny >= 1n << 64n) {
			throw new RangeError("The permission integer is too chonky to fit into 64 bits");
		}
		const base = i * 25;
		dv.setUint8(base + 0, overwrite.type);
		dv.setBigUint64(base + 1, BigInt(overwrite.id));
		dv.setBigUint64(base + 9, allow);
		dv.setBigUint64(base + 17, deny);
	}
	return new Uint8Array(dv.buffer);
}
export function decodePermissionOverwrites(buf: Uint8Array): DT.PermissionOverwrite[] {
	if (!(buf instanceof Uint8Array))
		throw TypeError("Not an Uint8Array.");
	if (buf.byteLength % 25 !== 0)
		throw TypeError("Size not a multiple of 25 bytes.");
	const length = buf.byteLength / 25;
	const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

	const overwrites: DT.PermissionOverwrite[] = [];
	for (let i = 0; i < length; i++) {
		const base = i * 25;
		overwrites[i] = {
			type: dv.getUint8(base + 0),
			id: String(dv.getBigUint64(base + 1)),
			allow: String(dv.getBigUint64(base + 9)),
			deny: String(dv.getBigUint64(base + 17)),
		};
	}
	return overwrites;
}

function encodeValue(type: ValueType, nullValue: NullValue | undefined, value: any): unknown {
	if (
		(type !== ValueType.StrictBoolean && value === undefined) ||
		(!(type === ValueType.Null || type === ValueType.StrictBoolean) && value === null) ||
		(nullValue === NullValue.EmptyArray && value instanceof Array && value.length === 0)
	) {
		if (nullValue === undefined && !(type === ValueType.Null || type === ValueType.StrictBoolean)) {
			throw new TypeError("The value is unexpectedly nullish.");
		}
		return null;
	}

	switch (type) {
		case ValueType.String:
		case ValueType.BigInteger:
		case ValueType.Float:
			return value;
		case ValueType.Integer:
		case ValueType.Boolean:
		case ValueType.StrictBoolean:
			return value == null ? 0n : BigInt(value);
		case ValueType.Base64:
			return Buffer.from(value, "base64");
		case ValueType.ImageHash:
			return encodeImageHash(value);
		case ValueType.BigIntegerArray:
			return encodeSnowflakeArray(value);
		case ValueType.Timestamp:
			return new Date(value).getTime();
		case ValueType.Emoji:
			return encodeEmojiProps(value);
		case ValueType.JSON:
			return JSON.stringify(value);
		case ValueType.Null:
			return 0;
	}
}
function decodeValue(type: ValueType, nullValue: NullValue | undefined, value: any): unknown {
	if (value === null) {
		return getNullValue(nullValue);
	} else if (value === undefined) {
		throw new TypeError("Missing column in SQL result");
	}

	switch (type) {
		case ValueType.String:
		case ValueType.Float:
			return value;
		case ValueType.Integer:
			return Number(value);
		case ValueType.Boolean:
		case ValueType.StrictBoolean:
			return Boolean(value);
		case ValueType.BigInteger:
			return String(value);
		case ValueType.Base64:
			return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64");
		case ValueType.ImageHash:
			return decodeImageHash(value);
		case ValueType.BigIntegerArray:
			return decodeSnowflakeArray(value);
		case ValueType.Timestamp:
			return new Date(Number(value)).toISOString();
			// More accurate (sometimes) version:
			// return new Date(value).toISOString().slice(0, -1) + "000+00:00";
		case ValueType.Emoji:
			return decodeEmojiProps(value);
		case ValueType.JSON:
			return JSON.parse(value);
		case ValueType.Null:
			return null;
	}
}

let logOnce: (name: string) => Logger | undefined = () => undefined;
export function setLogger(log: Logger | undefined): void {
	logOnce = createOnceFunction(log);
}

function encodeObjectRecursive(objectType: ObjectType, sqlArguments: any, prefix: string, schema: ProcessedSchema, object: any, partial: boolean) {
	const extra: Record<string, unknown> = {};

	for (const [key, type, nullValue] of schema.properties) {
		const value = object?.[key];
		if (partial && value === undefined) continue;

		if (type === "extra") {
			if (!(
				value === undefined ||
				(nullValue === NullValue.Null && value === null) ||
				(nullValue === NullValue.EmptyArray && value instanceof Array && value.length === 0)
			)) {
				extra[key] = value;
			}
		} else if (typeof type === "number") {
			// `type` is a `ValueType`.
			try {
				sqlArguments[prefix + key] = object == null ? null : encodeValue(type, nullValue, value);
			} catch (err) {
				throw new TypeError(`Cannot encode ${JSON.stringify(value)} (from ${ObjectType[objectType]}.${prefix.replaceAll("__", ".")}${key}) as ${ValueType[type]}.${err instanceof Error ? ` Error: ${err.message}` : ""}`);
			}
		} else {
			// `type` is a `ProcessedSchema`.
			const newPrefix = prefix + key + "__";
			const subExtra = encodeObjectRecursive(objectType, sqlArguments, newPrefix, type, value, partial);
			// If there are properties in `subExtra`, put it inside `extra`.
			for (const _ in subExtra) {
				extra[key] = subExtra;
				break;
			}
		}
	}

	for (const key in object) {
		if (!schema.knownKeys.has(key)) {
			extra[key] = object[key];
			logOnce(`unknown-key type=${objectType} prefix=${prefix} key=${key}`)?.warning?.(`Unknown key "${ObjectType[objectType]}.${key}" for object with ID ${object.id}. No data has been lost; the property will be archived. This might be related to an unsupported Discord feature. Consider updating this application to a newer version.`);
		}
	}

	return extra;
}
export function encodeObject(objectType: ObjectType, object: any, partial = false): any {
	const sqlArguments: any = {};
	let extra: string | null = JSON.stringify(encodeObjectRecursive(objectType, sqlArguments, "", processedSchemas[objectType], object, partial));
	if (extra === "{}") {
		extra = null;
	}
	sqlArguments._extra = extra;
	return sqlArguments;
}

function decodeObjectRecursive(objectType: ObjectType, schema: ProcessedSchema, sqlResult: any, prefix: string, extra: any): any {
	extra ??= {};
	const object: any = {};

	for (const [key, type, nullValue] of schema.properties) {
		let decodedValue;
		if (type === "extra") {
			const storedValue = extra[key];
			if (storedValue === undefined && nullValue === undefined) {
				return undefined;
			}
			decodedValue = storedValue === undefined ? getNullValue(nullValue) : storedValue;
		} else if (typeof type === "number") {
			// `type` is a `ValueType`.
			try {
				const storedValue = sqlResult[prefix + key];
				if (storedValue === null && nullValue === undefined) {
					return undefined;
				}
				decodedValue = decodeValue(type, nullValue, storedValue);
			} catch (err) {
				throw new TypeError(`Cannot decode ${prefix}${key} as ${ValueType[type]}. Stored value: ${sqlResult[key]}.${err instanceof Error ? ` Error: ${err.message}` : ""}`);
			}
		} else {
			// `type` is a `ProcessedSchema`.
			// If one of the required properties in the sub-object was null, then the sub-object itself must be null.
			decodedValue = decodeObjectRecursive(objectType, type, sqlResult, prefix + key + "__", extra[key]);
			if (decodedValue === undefined) {
				try {
					decodedValue = getNullValue(nullValue);
				} catch (err) {
					throw new TypeError(`Cannot decode ${prefix}${key}. ${err instanceof Error ? ` Error: ${err.message}` : ""}`);
				}
			}
		}
		delete extra[key];
		if (decodedValue !== undefined) {
			object[key] = decodedValue;
		}
	}

	Object.assign(object, extra);
	// for (const key in extra) {
	// 	const entry = schema.properties.find(p => p[0] === key);
	// 	if (entry === undefined) {
	// 		object[key] = extra[key];
	// 	} else {
	// 		if (entry[1] !== "extra") {
	// 			throw new TypeError(``);
	// 		}
	// 	}
	// }

	return object;
}
export function decodeObject(objectType: ObjectType, sqlResult: any): any {
	return decodeObjectRecursive(objectType, processedSchemas[objectType], sqlResult, "", JSON.parse(sqlResult._extra));
}
