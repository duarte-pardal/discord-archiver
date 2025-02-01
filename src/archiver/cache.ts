import * as DT from "../discord-api/types.js";
import { Account } from "./accounts.js";

/** Temporary data structure used only for syncing threads */
export type ThreadInfo = {
	id: string;
	name: string;
	parent: CachedChannel;
	private: boolean;
	syncInfo: {
		lastMessageID: string | null;
		messageCount: number | null;
	};
};
export type CachedChannel = {
	id: string;
	type: DT.ChannelType;
	guild: CachedGuild | null;
	name: string;
	/** The permission overwrite bitfield for each role */
	permissionOverwrites: Map<string, { allow: bigint; deny: bigint }>;
	/** Accounts with the READ_MESSAGE_HISTORY and VIEW_CHANNEL permissions */
	accountsWithReadPermission: Set<Account>;
	/** Accounts with the READ_MESSAGE_HISTORY, MANAGE_THREADS and VIEW_CHANNEL permissions */
	accountsWithManageThreadsPermission: Set<Account>;
	parent: null;
	/** Data used for syncing, set to null after it's not needed anymore. */
	syncInfo: {
		lastMessageID: string | null;
		messageCount: number | null;
		/** The active threads found in the ready payload */
		activeThreads: Set<ThreadInfo>;
	} | null;
};
export type CachedChannelWithSyncInfo = CachedChannel & { syncInfo: NonNullable<CachedChannel["syncInfo"]> };

export type GuildAccountData = {
	/** The IDs of the roles assigned to the account */
	roles: Set<string>;
	/** The computed guild permissions */
	guildPermissions: bigint;
};
export type CachedGuild = {
	id: string;
	name: string;
	ownerID: string;
	/** The permission bitfield for each role, indexed by the role ID */
	rolePermissions: Map<string, bigint>;
	accountData: Map<Account, GuildAccountData>;
	textChannels: Map<string, CachedChannel>;
	memberUserIDs: Set<bigint> | null;
	/**
	 * Resolved when the guild is stored in the database. This is needed because the initial sync
	 * involves download the guild's icon, if it has one.
	 */
	initialSyncPromise: Promise<void>;
};

export const guilds = new Map<string, CachedGuild>();
export const dmChannels = new Map<string, CachedChannel>();

type GuildCacheableChannel = DT.GuildAnnouncementChannel | DT.GuildForumChannel | DT.GuildTextChannel | DT.GuildVoiceChannel;

export function isChannelCacheable(channel: DT.Channel): channel is GuildCacheableChannel {
	return (
		channel.type === DT.ChannelType.GuildAnnouncement ||
		channel.type === DT.ChannelType.GuildForum ||
		channel.type === DT.ChannelType.GuildText ||
		channel.type === DT.ChannelType.GuildVoice
	);
}

export function createCachedChannel(channel: GuildCacheableChannel, cachedGuild: CachedGuild): CachedChannelWithSyncInfo {
	return {
		id: channel.id,
		type: channel.type,
		guild: cachedGuild,
		name: channel.name,
		permissionOverwrites: new Map(channel.permission_overwrites?.map(o => [o.id, { allow: BigInt(o.allow), deny: BigInt(o.deny) }])),
		accountsWithReadPermission: new Set(),
		accountsWithManageThreadsPermission: new Set(),
		parent: null,
		syncInfo: {
			activeThreads: new Set(),
			lastMessageID: channel.type === DT.ChannelType.GuildVoice ? null : (channel.last_message_id ?? null),
			messageCount: null,
		},
	};
}

export function extractThreadInfo(thread: DT.Thread, parent: CachedChannel): ThreadInfo {
	return {
		id: thread.id,
		name: thread.name,
		parent,
		private: thread.type === DT.ChannelType.PrivateThread,
		syncInfo: {
			lastMessageID: thread.last_message_id ?? null,
			messageCount: (
				BigInt(thread.id) < 992580363878400000n && (thread.message_count === undefined || thread.message_count >= 50) ?
					thread.total_message_sent :
					thread.message_count
			) ?? null,
		},
	};
}
