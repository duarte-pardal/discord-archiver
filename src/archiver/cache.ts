import * as DT from "../discord-api/types.js";
import { Account, OngoingMessageSync, OngoingThreadSync } from "./accounts.js";
import { ChannelOptions, getChannelOptions, getThreadOptions, GuildOptions, ParsedConfig } from "./config.js";

export type MessageSyncFields = {
	/** ID of the latest message as of the start of the latest gateway session, or `null` if unknown. Used for determining whether to sync the channel and for estimating the remaining sync time. It is assumed that any message with a greater ID would be handled by the MESSAGE_CREATE dispatch handler, and, as such, it's not necessary to sync messages with a greater ID. */
	lastMessageID: bigint | null;
	/** Approximate message count */
	messageCount?: number | null;

	/** Whether all messages in the channel are currently synced. */
	areMessagesSynced: boolean;
	/** Message ID such that all messages with ID lesser than or equal to this ID are stored in the database, or `undefined` if the value has not yet been read from the database. */
	lastSyncedMessageID: bigint | undefined;
	pendingMessageSyncUpdate: boolean;
	messageSync: OngoingMessageSync | null;
};

export type CachedThread = MessageSyncFields & {
	id: string;
	options: ChannelOptions;
	name: string;
	guild: CachedGuild | null;
	parent: CachedTextLikeChannel;
	private: boolean;
	active: boolean;
};
export type CachedSimpleChannel = {
	id: string;
	options: ChannelOptions;
	type: DT.ChannelType;
	textLike: false;
	guild: CachedGuild | null;
};
export type CachedPermissionOverwrites = Map<string, { allow: bigint; deny: bigint }>;
export type CachedTextLikeChannel = MessageSyncFields & {
	id: string;
	options: ChannelOptions;
	type: DT.ChannelType.GuildText | DT.ChannelType.GuildVoice | DT.ChannelType.GuildAnnouncement | DT.ChannelType.GuildStageVoice | DT.ChannelType.GuildForum | DT.ChannelType.GuildMedia;
	textLike: true;
	hasThreads: boolean;
	name: string;
	guild: CachedGuild | null;
	/** The permission overwrite bitfield for each role */
	permissionOverwrites: CachedPermissionOverwrites;
	/** Accounts that have permission to read the message history */
	accountsWithReadPermission: Account[];
	/** Accounts that have permission to see private archived threads */
	accountsWithManageThreadsPermission: Account[];
	parent: null;
	/** Archived threads being synced and all active threads */
	threads: Map<string, CachedThread>;

	arePublicThreadsSynced: boolean;
	pendingPublicThreadSyncUpdate: boolean;
	publicThreadSync: OngoingThreadSync | null;
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
export const directChannels = new Map<string, CachedTextLikeChannel>();

export type GuildTextLikeChannel = DT.GuildTextChannel | DT.GuildVoiceChannel | DT.GuildAnnouncementChannel | DT.GuildStageChannel | DT.GuildForumChannel | DT.GuildMediaChannel;
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
export type TextChannelWithThreads = DT.GuildTextChannel | DT.GuildAnnouncementChannel | DT.GuildForumChannel | DT.GuildMediaChannel;
export function isChannelWithThreads(channel: DT.Channel): channel is TextChannelWithThreads {
	return (
		channel.type === DT.ChannelType.GuildText ||
		channel.type === DT.ChannelType.GuildAnnouncement ||
		channel.type === DT.ChannelType.GuildForum ||
		channel.type === DT.ChannelType.GuildMedia
	);
}

export function cacheChannel(cachedChannel: CachedTextLikeChannel | undefined, channel: DT.Channel, config: ParsedConfig, updateLastMessage?: boolean, cachedGuild?: CachedGuild | null): CachedTextLikeChannel;
export function cacheChannel(cachedChannel: CachedChannel | undefined, channel: DT.Channel, config: ParsedConfig, updateLastMessage?: boolean, cachedGuild?: CachedGuild | null): CachedChannel;
export function cacheChannel(cachedChannel: CachedChannel | undefined, channel: DT.Channel, config: ParsedConfig, updateLastMessage = false, cachedGuild?: CachedGuild | null): CachedChannel {
	const isNew = cachedChannel === undefined;
	if (isGuildTextLikeChannel(channel)) {
		if (cachedGuild == null) {
			throw TypeError("Cached guild missing");
		}

		cachedChannel = (cachedChannel as CachedTextLikeChannel | undefined) ?? {
			id: channel.id,
			options: getChannelOptions(config, channel.id, cachedGuild.options),
			type: channel.type,
			textLike: true,
			hasThreads: isChannelWithThreads(channel),
			guild: cachedGuild,
			name: "", // will be replaced below
			permissionOverwrites: null as any, // will be replaced below
			accountsWithReadPermission: [],
			accountsWithManageThreadsPermission: [],
			parent: null,
			threads: new Map(),

			arePublicThreadsSynced: false,
			pendingPublicThreadSyncUpdate: false,
			publicThreadSync: null,

			lastMessageID: null, // will be replaced below

			areMessagesSynced: false,
			lastSyncedMessageID: undefined,
			pendingMessageSyncUpdate: false,
			messageSync: null,
		} satisfies CachedTextLikeChannel;

		cachedChannel.name = channel.name;
		cachedChannel.permissionOverwrites = new Map(channel.permission_overwrites?.map(o => [o.id, { allow: BigInt(o.allow), deny: BigInt(o.deny) }]));
		if (isNew || updateLastMessage) {
			cachedChannel.lastMessageID = channel.last_message_id == null ? null : BigInt(channel.last_message_id);
		}
	} else {
		cachedChannel ??= {
			id: channel.id,
			options: getChannelOptions(config, channel.id, cachedGuild?.options),
			type: channel.type,
			textLike: false,
			guild: cachedGuild ?? null,
		};
	}

	if (isNew) {
		(cachedGuild?.channels ?? directChannels).set(cachedChannel.id, cachedChannel);
	}

	return cachedChannel;
}

/** Adds a new thread to the cache or updates the thread object already in the cache. */
export function cacheThread(cachedThread: CachedThread | undefined, thread: DT.Thread, config: ParsedConfig, cachedParent: CachedTextLikeChannel, updateLastMessage: boolean): CachedThread {
	const isNew = cachedThread === undefined;
	cachedThread ??= {
		id: thread.id,
		options: getThreadOptions(config, thread.id, cachedParent.options),
		name: "", // will be replaced below
		guild: cachedParent.guild,
		parent: cachedParent,
		private: thread.type === DT.ChannelType.PrivateThread,
		active: true, // will be replaced below
		lastMessageID: null, // will be replaced below
		messageCount: null, // will be replaced below
		areMessagesSynced: false,
		lastSyncedMessageID: undefined,
		pendingMessageSyncUpdate: false,
		messageSync: null,
	};

	cachedThread.name = thread.name;
	cachedThread.active = !thread.thread_metadata.archived;
	if (isNew || updateLastMessage) {
		cachedThread.lastMessageID = thread.last_message_id == null ? null : BigInt(thread.last_message_id);
		cachedThread.messageCount = (
			BigInt(thread.id) < 992580363878400000n && (thread.message_count === undefined || thread.message_count >= 50) ?
				thread.total_message_sent :
				thread.message_count
		) ?? null;
	}

	if (isNew) {
		cachedParent.threads.set(cachedThread.id, cachedThread);
	}

	return cachedThread;
}
