import * as DT from "../discord-api/types.js";
import { Account } from "./accounts.js";
import { ChannelOptions, getChannelOptions, getThreadOptions, GuildOptions, ParsedConfig } from "./config.js";

export type CachedThread = {
	id: string;
	options: ChannelOptions;
	name: string;
	guild: CachedGuild | null;
	parent: CachedTextLikeChannel;
	private: boolean;
	/** ID of the latest message. Used for determining whether to sync the channel and for estimating the remaining sync time. */
	lastMessageID: string | null;
	/** Approximate message count */
	messageCount: number | null;
};
export type CachedSimpleChannel = {
	id: string;
	options: ChannelOptions;
	type: DT.ChannelType;
	textLike: false;
	guild: CachedGuild | null;
};
export type CachedTextLikeChannel = {
	id: string;
	options: ChannelOptions;
	type: DT.ChannelType.GuildText | DT.ChannelType.GuildVoice | DT.ChannelType.GuildAnnouncement | DT.ChannelType.GuildStageVoice | DT.ChannelType.GuildForum | DT.ChannelType.GuildMedia;
	textLike: true;
	hasThreads: boolean;
	name: string;
	guild: CachedGuild | null;
	/** The permission overwrite bitfield for each role */
	permissionOverwrites: Map<string, { allow: bigint; deny: bigint }>;
	/** Accounts with the READ_MESSAGE_HISTORY and VIEW_CHANNEL permissions */
	accountsWithReadPermission: Set<Account>;
	/** Accounts with the READ_MESSAGE_HISTORY, MANAGE_THREADS and VIEW_CHANNEL permissions */
	accountsWithManageThreadsPermission: Set<Account>;
	parent: null;
	/** ID of the latest message. Used for determining whether to sync the channel and for estimating the remaining sync time. */
	lastMessageID: string | null;
};
export type CachedChannel = CachedSimpleChannel | CachedTextLikeChannel;

export type GuildAccountData = {
	/** The IDs of the roles assigned to the account */
	roles: Set<string>;
	/** The computed guild permissions */
	guildPermissions: bigint;
};
export type CachedGuild = {
	id: string;
	options: GuildOptions;
	name: string;

	ownerID: string;
	/** The permission bitfield for each role, indexed by the role ID */
	rolePermissions: Map<string, bigint>;
	accountData: Map<Account, GuildAccountData>;
	/**
	 * Accounts with the CREATE_GUILD_EXPRESSIONS or the MANAGE_GUILD_EXPRESSIONS permission,
	 * required to view who uploaded each emoji, sticker, and soundboard sound.
	 */
	accountsWithExpressionPermission: Set<Account>;

	channels: Map<string, CachedChannel>;
	/** The active threads found in the ready payload */
	activeThreads: Map<string, CachedThread>;
	memberUserIDs: Set<bigint> | null;

	/** Whether we are missing uploader info for some emojis. */
	missingEmojiUploaders: boolean | undefined;

	/**
	 * Resolved when the guild is stored in the database. This is needed because we can't archive
	 * sub-objects (e.g. messages) in the database before the guild is archived.
	 */
	initialSyncPromise: Promise<void>;
};

export const guilds = new Map<string, CachedGuild>();
export const dmChannels = new Map<string, CachedTextLikeChannel>();

type GuildTextLikeChannel = DT.GuildTextChannel | DT.GuildVoiceChannel | DT.GuildAnnouncementChannel | DT.GuildStageChannel | DT.GuildForumChannel | DT.GuildMediaChannel;
export function isGuildTextLikeChannel(channel: DT.Channel): channel is GuildTextLikeChannel {
	return (
		channel.type === DT.ChannelType.GuildText ||
		channel.type === DT.ChannelType.GuildVoice ||
		channel.type === DT.ChannelType.GuildAnnouncement ||
		channel.type === DT.ChannelType.GuildStageVoice ||
		channel.type === DT.ChannelType.GuildForum ||
		channel.type === DT.ChannelType.GuildMedia
	);
}
type TextChannelWithThreads = DT.GuildTextChannel | DT.GuildAnnouncementChannel | DT.GuildForumChannel | DT.GuildMediaChannel;
export function isChannelWithThreads(channel: DT.Channel): channel is TextChannelWithThreads {
	return (
		channel.type === DT.ChannelType.GuildText ||
		channel.type === DT.ChannelType.GuildAnnouncement ||
		channel.type === DT.ChannelType.GuildForum ||
		channel.type === DT.ChannelType.GuildMedia
	);
}

export function createCachedChannel(channel: DT.Channel, config: ParsedConfig, cachedGuild?: CachedGuild): CachedChannel {
	if (isGuildTextLikeChannel(channel)) {
		if (cachedGuild === undefined) {
			throw TypeError("Guild missing for channel creation");
		}
		return {
			id: channel.id,
			options: getChannelOptions(config, channel.id, cachedGuild.options),
			type: channel.type,
			textLike: true,
			hasThreads: isChannelWithThreads(channel),
			guild: cachedGuild,
			name: channel.name,
			permissionOverwrites: new Map(channel.permission_overwrites?.map(o => [o.id, { allow: BigInt(o.allow), deny: BigInt(o.deny) }])),
			accountsWithReadPermission: new Set(),
			accountsWithManageThreadsPermission: new Set(),
			parent: null,
			lastMessageID: channel.last_message_id ?? null,
		};
	} else {
		return {
			id: channel.id,
			options: getChannelOptions(config, channel.id, cachedGuild?.options),
			type: channel.type,
			textLike: false,
			guild: cachedGuild ?? null,
		};
	}
}

export function createCachedThread(thread: DT.Thread, config: ParsedConfig, parent: CachedTextLikeChannel): CachedThread {
	return {
		id: thread.id,
		options: getThreadOptions(config, thread.id, parent.options),
		name: thread.name,
		guild: parent.guild,
		parent,
		private: thread.type === DT.ChannelType.PrivateThread,
		lastMessageID: thread.last_message_id ?? null,
		messageCount: (
			BigInt(thread.id) < 992580363878400000n && (thread.message_count === undefined || thread.message_count >= 50) ?
				thread.total_message_sent :
				thread.message_count
		) ?? null,
	};
}
