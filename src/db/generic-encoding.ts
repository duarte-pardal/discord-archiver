/**
 * @fileoverview Handles the operations in the conversion from objects in the Discord API format to the database format and back that are common to all object types.
 *
 * Most of the conversion work is done here, with some operations specific to each object type being handled in `worker.ts`.
 */

import * as DT from "../discord-api/types.js";

export enum ObjectType {
	User,
	Guild,
	Role,
	Member,
	Channel,
	Message,
	Attachment,
	ForumTag,
}

type RealObjectType = {
	[ObjectType.User]: DT.PartialUser;
	[ObjectType.Guild]: DT.Guild;
	[ObjectType.Role]: DT.Role;
	[ObjectType.Member]: DT.GuildMember;
	[ObjectType.Channel]: DT.Channel;
	[ObjectType.Message]: DT.Message;
	[ObjectType.Attachment]: DT.Attachment;
	[ObjectType.ForumTag]: DT.ForumThreadTag;
};

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
	/** `NULL` means that the property is not in the object */
	Absent,
	/** `NULL` means that the value is `null` */
	Null,
	/** `NULL` means that the value is `[]` */
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
type PropertyInfo<K> = [key: K, type: ValueType, nullValue?: NullValue];
type Schema<O> = {
	properties: PropertyInfo<O extends O ? keyof O : never>[];
	subObjectProperties: [key: O extends O ? keyof O : never, properties: PropertyInfo<string>[], nullValue?: NullValue][];
};

const schemas: { [OT in ObjectType]: Schema<RealObjectType[OT]> } = {
	[ObjectType.User]: {
		properties: [
			["id", ValueType.BigInteger],
			["bot", ValueType.StrictBoolean],

			["username", ValueType.String],
			["global_name", ValueType.String, NullValue.Null],
			["avatar", ValueType.ImageHash, NullValue.Null],
			["public_flags", ValueType.Integer, NullValue.Absent],
		],
		subObjectProperties: [],
	},
	[ObjectType.Guild]: {
		properties: [
			["id", ValueType.BigInteger],

			["name", ValueType.String],
			["icon", ValueType.ImageHash, NullValue.Null],
			["splash", ValueType.ImageHash, NullValue.Null],
			["discovery_splash", ValueType.ImageHash, NullValue.Null],
			["owner_id", ValueType.BigInteger, NullValue.Null],
			["afk_channel_id", ValueType.BigInteger, NullValue.Null],
			["afk_timeout", ValueType.Integer],
			["widget_enabled", ValueType.StrictBoolean],
			["widget_channel_id", ValueType.BigInteger, NullValue.Null],
			["verification_level", ValueType.Integer],
			["default_message_notifications", ValueType.Integer],
			["explicit_content_filter", ValueType.Integer],
			["mfa_level", ValueType.Integer],
			["system_channel_id", ValueType.BigInteger, NullValue.Null],
			["system_channel_flags", ValueType.BigInteger],
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
			["nsfw_level", ValueType.Integer],
			["premium_progress_bar_enabled", ValueType.StrictBoolean],
		],
		subObjectProperties: [],
	},
	[ObjectType.Role]: {
		properties: [
			["id", ValueType.BigInteger],
			["managed", ValueType.Boolean],

			["name", ValueType.String],
			["color", ValueType.Integer],
			["hoist", ValueType.Boolean],
			["icon", ValueType.ImageHash, NullValue.Null],
			["unicode_emoji", ValueType.String, NullValue.Null],
			["position", ValueType.Integer],
			["permissions", ValueType.BigInteger],
			["mentionable", ValueType.Boolean],
			["flags", ValueType.Integer],
		],
		subObjectProperties: [
			["tags", [
				["bot_id", ValueType.BigInteger, NullValue.Absent],
				["integration_id", ValueType.BigInteger, NullValue.Absent],
				["premium_subscriber", ValueType.Null, NullValue.Absent],
				["subscription_listing_id", ValueType.BigInteger, NullValue.Absent],
				["available_for_purchase", ValueType.Null, NullValue.Absent],
				["guild_connections", ValueType.Null, NullValue.Absent],
			], NullValue.Absent],
		],
	},
	[ObjectType.Member]: {
		properties: [
			["nick", ValueType.String, NullValue.Null],
			["avatar", ValueType.ImageHash, NullValue.Null],
			["roles", ValueType.BigIntegerArray],
			["joined_at", ValueType.Timestamp],
			["premium_since", ValueType.Timestamp, NullValue.Null],
			["flags", ValueType.Integer],
			["pending", ValueType.StrictBoolean],
			["communication_disabled_until", ValueType.Timestamp, NullValue.Null],
		],
		subObjectProperties: [],
	},
	[ObjectType.Channel]: {
		properties: [
			// TODO: What the SQL `NULL` value should mean depends on the channel type. Currently we always decode those to `null`. Namely:
			// If the channel is a group DM, `name` and `icon` are never absent but may be null; if not, they are always absent.
			// If the channel is a guild text or announcement channel, `topic` is never absent but may be null; if not, it is always absent.
			// If the channel is a voice channel, `rtc_region` is never absent but may be null; if not, it is always absent.
			// If the channel is a forum channel, `default_reaction_emoji` is never absent but may be null; if not, it is always absent.
			["id", ValueType.BigInteger],
			["type", ValueType.Integer],
			["guild_id", ValueType.BigInteger, NullValue.Absent],
			["position", ValueType.Integer, NullValue.Absent],
			["name", ValueType.String, NullValue.Null],
			["topic", ValueType.String, NullValue.Null],
			["nsfw", ValueType.Boolean, NullValue.Absent],
			["bitrate", ValueType.Integer, NullValue.Absent],
			["user_limit", ValueType.Integer, NullValue.Absent],
			["rate_limit_per_user", ValueType.Integer, NullValue.Absent],
			["icon", ValueType.ImageHash, NullValue.Null],
			["owner_id", ValueType.BigInteger, NullValue.Absent],
			["parent_id", ValueType.BigInteger, NullValue.Null],
			["rtc_region", ValueType.String, NullValue.Null],
			["video_quality_mode", ValueType.Integer, NullValue.Absent],
			["default_auto_archive_duration", ValueType.Integer, NullValue.Absent],
			["flags", ValueType.Integer, NullValue.Absent],
			["applied_tags", ValueType.BigIntegerArray, NullValue.Absent],
			["default_reaction_emoji", ValueType.Emoji, NullValue.Null],
			["default_thread_rate_limit_per_user", ValueType.Integer, NullValue.Absent],
			["default_sort_order", ValueType.Integer, NullValue.Null],
			["default_forum_layout", ValueType.Integer, NullValue.Absent],
		],
		subObjectProperties: [
			["thread_metadata", [
				["archived", ValueType.Boolean],
				["auto_archive_duration", ValueType.Integer],
				["archive_timestamp", ValueType.Timestamp],
				["locked", ValueType.Boolean],
				["invitable", ValueType.Boolean, NullValue.Absent],
				["create_timestamp", ValueType.Timestamp, NullValue.Absent],
			], NullValue.Absent],
		],
	},
	[ObjectType.Message]: {
		properties: [
			["id", ValueType.BigInteger],
			["channel_id", ValueType.BigInteger],
			["tts", ValueType.Boolean],
			["mention_everyone", ValueType.Boolean],
			["mention_roles", ValueType.BigIntegerArray],
			["type", ValueType.Integer],

			["content", ValueType.String],
			["flags", ValueType.Integer],
			["embeds", ValueType.JSON, NullValue.EmptyArray],
			["components", ValueType.JSON, NullValue.EmptyArray],
		],
		subObjectProperties: [
			["activity", [
				["type", ValueType.Integer],
				["party_id", ValueType.String],
			], NullValue.Absent],
			["interaction", [
				["id", ValueType.BigInteger],
				["type", ValueType.Integer],
				["name", ValueType.String],
			], NullValue.Absent],
		],
	},
	[ObjectType.Attachment]: {
		properties: [
			["id", ValueType.BigInteger],
			["filename", ValueType.String],
			["description", ValueType.String, NullValue.Absent],
			["content_type", ValueType.String, NullValue.Absent],
			["size", ValueType.Integer],

			["height", ValueType.Integer, NullValue.Absent],
			["width", ValueType.Integer, NullValue.Absent],
			["ephemeral", ValueType.StrictBoolean],
			["duration_secs", ValueType.Float, NullValue.Absent],
			["waveform", ValueType.Base64, NullValue.Absent],
			["flags", ValueType.Integer, NullValue.Absent],
		],
		subObjectProperties: [],
	},
	[ObjectType.ForumTag]: {
		properties: [
			["id", ValueType.BigInteger],
			["name", ValueType.String],
			["moderated", ValueType.Boolean],
		],
		subObjectProperties: [],
	},
};

// TODO: Avatar decoration hashes (v2_*)
// It is unknown if there will be a v3, v4, etc. and if the format will stay consistent
const IMAGE_HASH_REGEX = /^(a_)?([0-9a-f]{32})$/;
export function encodeImageHash(hash: string): Uint8Array | string {
	if (typeof hash !== "string")
		throw TypeError("Only strings can be encoded into the image hash representation.");

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
		throw TypeError("Not an Uint8Array.");
	if (encodedHash.byteLength !== 17)
		throw TypeError("Invalid size.");

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
	const emoji = decodeEmoji(data);
	return {
		emoji_id: emoji.id,
		emoji_name: emoji.name,
	} as DiscordEmojiProps;
}
export function encodeEmoji(emoji: DT.PartialEmoji): bigint | string {
	if (emoji.id != null)
		return BigInt(emoji.id);
	else
		return emoji.name;
}
export function decodeEmoji(data: bigint | string): DT.PartialEmoji {
	if (typeof data === "bigint")
		// TODO: Lookup the emoji name
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
			throw new TypeError("The NULL value is undefined.");
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

export function encodeObject(objectType: ObjectType, object: any, partial = false): any {
	const schema = schemas[objectType];
	const sqlArguments: any = {};
	for (const [key, type, nullValue] of schema.properties) {
		if (!(partial && object[key] === undefined)) {
			try {
				sqlArguments[key] = encodeValue(type, nullValue, object[key]);
			} catch (err) {
				throw new TypeError(`Cannot encode ${ObjectType[objectType]}.${key} as ${ValueType[type]}. Value: ${JSON.stringify(object[key])}.${err instanceof Error ? ` Error: ${err.message}` : ""}`);
			}
		}
	}
	for (const [key, properties] of schema.subObjectProperties) {
		if (!(partial && object[key] === undefined)) {
			const subObject = object[key];
			for (const [subKey, type, nullValue] of properties) {
				try {
					sqlArguments[`${key}__${subKey}`] = subObject == null ? null : encodeValue(type, nullValue, subObject[subKey]);
				} catch (err) {
					throw new TypeError(`Cannot encode ${ObjectType[objectType]}.${key}.${subKey} as ${ValueType[type]}. Value: ${JSON.stringify(subObject[subKey])}.${err instanceof Error ? ` Error: ${err.message}` : ""}`);
				}
			}
		}
	}
	return sqlArguments;
}
export function decodeObject(objectType: ObjectType, sqlResult: any): any {
	const schema = schemas[objectType];
	const object: any = {};
	for (const [key, type, nullValue] of schema.properties) {
		try {
			const value = decodeValue(type, nullValue, sqlResult[key]);
			if (value !== undefined)
				object[key] = value;
		} catch (err) {
			throw new TypeError(`Cannot decode ${ObjectType[objectType]}.${key} as ${ValueType[type]}. Stored value: ${sqlResult[key]}.${err instanceof Error ? ` Error: ${err.message}` : ""}`);
		}
	}
	subObjects:
	for (const [key, properties, objNullValue] of schema.subObjectProperties) {
		const subObject: any = {};
		for (const [subKey, type, propNullValue] of properties) {
			try {
				if (sqlResult[`${key}__${subKey}`] === null && propNullValue === undefined) {
					// The property can't be null, so the sub-object itself must be null
					object[key] = getNullValue(objNullValue);
					continue subObjects;
				}
				subObject[subKey] = decodeValue(type, propNullValue, sqlResult[`${key}__${subKey}`]);
			} catch (err) {
				throw new TypeError(`Cannot decode ${ObjectType[objectType]}.${key}.${subKey} as ${ValueType[type]}. Stored value: ${sqlResult[`${key}__${subKey}`]}.${err instanceof Error ? ` Error: ${err.message}` : ""}`);
			}
		}
		object[key] = subObject;
	}
	return object;
}
