import * as DT from "../discord-api/types.js";

export type CustomEmojiData = Omit<DT.CustomEmoji, "available">;

export type Timing = {
	timestamp: number;
	realtime: boolean;
};

export const enum AddSnapshotResult {
	/** There were no snapshots in the database, this is the first. */
	AddedFirstSnapshot,
	/** There were already snapshots in the database and a new one was added. */
	AddedAnotherSnapshot,
	/** The provided object was equal to the latest recorded snapshot. No snapshot was added. */
	SameAsLatest,
	/** A partial update was requested but there was no previous snapshot. The database wasn't modified. */
	PartialNoSnapshot,
}

export const enum RequestType {
	Close,
	BeginTransaction,
	CommitTransaction,
	RollbackTransaction,
	Optimize,
	Vacuum,
	AddUserSnapshot,
	SyncDeletedGuildSubObjects,
	AddGuildSnapshot,
	SyncGuildMembers,
	AddMemberSnapshot,
	AddMemberLeave,
	AddRoleSnapshot,
	MarkRoleAsDeleted,
	GetRoles,
	AddChannelSnapshot,
	MarkChannelAsDeleted,
	GetChannels,
	AddThreadSnapshot,
	MarkThreadAsDeleted,
	GetThreads,
	GetForumTags,
	AddMessageSnapshot,
	MarkMessageAsDeleted,
	GetMessages,
	AddInitialReactions,
	AddReactionPlacement,
	MarkReactionAsRemoved,
	MarkReactionsAsRemovedBulk,
	AddGuildEmojiSnapshot,
	MarkGuildEmojiAsDeleted,
	UpdateEmojiUploaders,
	CheckForMissingEmojiUploaders,
	GetGuildEmojis,
	GetFile,
	GetFiles,
	GetFileHashUtilization,
	AddFile,
	GetLastMessageID,
	GetGuilds,
	SearchMessages,
}

// In add snapshot requests, `timing === null` indicates that the snapshot depicts the state of the object upon creation.

export type CommandRequest = {
	type:
		RequestType.Close |
		RequestType.BeginTransaction |
		RequestType.CommitTransaction |
		RequestType.RollbackTransaction |
		RequestType.Optimize |
		RequestType.Vacuum;
};
export type AddUserSnapshotRequest = {
	type: RequestType.AddUserSnapshot;
	timing: Timing | null;
	user: DT.PartialUser;
};
export type SyncDeletedGuildSubObjectsRequest = {
	type: RequestType.SyncDeletedGuildSubObjects;
	timing: Timing;
	guildID: bigint;
	channelIDs?: Set<bigint> | undefined;
	roleIDs?: Set<bigint> | undefined;
	emojiIDs?: Set<bigint> | undefined;
};
export type AddGuildSnapshotRequest = {
	type: RequestType.AddGuildSnapshot;
	timing: Timing | null;
	guild: DT.Guild;
};
export type AddRoleSnapshotRequest = {
	type: RequestType.AddRoleSnapshot;
	timing: Timing | null;
	role: DT.Role;
	guildID: string;
};
export type MarkRoleAsDeletedRequest = {
	type: RequestType.MarkRoleAsDeleted;
	timing: Timing;
	id: string;
};
export type GetRolesRequest = {
	type: RequestType.GetRoles;
	timestamp?: number | null | undefined;
	guildID: string;
};
export type SyncGuildMembersRequest = {
	type: RequestType.SyncGuildMembers;
	timing: Timing;
	guildID: bigint;
	userIDs: Set<bigint>;
};
export type AddMemberSnapshotFromFullRequest = {
	type: RequestType.AddMemberSnapshot;
	partial: false;
	timing: Timing | null;
	guildID: string;
	userID: string;
	member: DT.GuildMember;
};
export type AddMemberSnapshotFromPartialRequest = {
	type: RequestType.AddMemberSnapshot;
	partial: true;
	timing: Timing | null;
	guildID: string;
	userID: string;
	member: Partial<DT.GuildMember>;
};
export type AddMemberLeaveRequest = {
	type: RequestType.AddMemberLeave;
	timing: Timing;
	guildID: string;
	userID: string;
};
export type AddChannelSnapshotRequest = {
	type: RequestType.AddChannelSnapshot;
	timing: Timing | null;
	channel: DT.DirectChannel | DT.GuildChannel;
};
export type MarkChannelAsDeletedRequest = {
	type: RequestType.MarkChannelAsDeleted;
	timing: Timing;
	id: string;
};
export type GetChannelsRequest = {
	type: RequestType.GetChannels;
	timestamp?: number | null | undefined;
	guildID?: string | null | undefined;
};
export type AddThreadSnapshotRequest = {
	type: RequestType.AddThreadSnapshot;
	timing: Timing | null;
	thread: DT.Thread;
};
export type MarkThreadAsDeletedRequest = {
	type: RequestType.MarkThreadAsDeleted;
	timing: Timing;
	id: string;
};
export type GetThreadsRequest = {
	type: RequestType.GetThreads;
	timestamp?: number | null | undefined;
	parentID: string;
};
export type GetForumTagsRequest = {
	type: RequestType.GetForumTags;
	timestamp?: number | null | undefined;
	channelID: string;
};
export type AddMessageSnapshotRequest = {
	type: RequestType.AddMessageSnapshot;
	/** Used for the timing of the users' (e.g. author) snapshots. */
	timestamp: number;
	message: DT.Message;
};
export type MarkMessageAsDeletedRequest = {
	type: RequestType.MarkMessageAsDeleted;
	timing: Timing;
	id: string;
};
export type GetMessagesRequest = {
	type: RequestType.GetMessages;
	timestamp?: number | null | undefined;
	channelID: string;
};
export type AddInitialReactionsRequest = {
	type: RequestType.AddInitialReactions;
	messageID: string;
	emoji: DT.PartialEmoji;
	reactionType: 0 | 1;
	userIDs: string[];
};
export type AddReactionPlacementRequest = {
	type: RequestType.AddReactionPlacement;
	messageID: string;
	emoji: DT.PartialEmoji;
	reactionType: 0 | 1;
	userID: string;
	timing: Timing;
};
export type MarkReactionAsRemovedRequest = {
	type: RequestType.MarkReactionAsRemoved;
	messageID: string;
	emoji: DT.PartialEmoji;
	reactionType: 0 | 1;
	userID: string;
	timing: Timing;
};
export type MarkReactionAsRemovedBulkRequest = {
	type: RequestType.MarkReactionsAsRemovedBulk;
	messageID: string;
	emoji: DT.PartialEmoji | null;
	timing: Timing;
};
export type AddGuildEmojiSnapshotRequest = {
	type: RequestType.AddGuildEmojiSnapshot;
	timing: Timing | null;
	emoji: CustomEmojiData;
	guildID: string;
};
export type MarkGuildEmojiAsDeletedRequest = {
	type: RequestType.MarkGuildEmojiAsDeleted;
	timing: Timing;
	id: string;
};
export type UpdateEmojiUploadersRequest = {
	type: RequestType.UpdateEmojiUploaders;
	emojis: {
		id: string;
		user__id: string;
	}[];
};
export type CheckForMissingEmojiUploadersRequest = {
	type: RequestType.CheckForMissingEmojiUploaders;
	guildID: string;
};
export type GetGuildEmojisRequest = {
	type: RequestType.GetGuildEmojis;
	timestamp?: number | null | undefined;
	guildID: string;
};
export type GetFileRequest = {
	type: RequestType.GetFile;
	url: string;
};
export type GetFilesRequest = {
	type: RequestType.GetFiles;
};
export type GetFileHashUtilizationRequest = {
	type: RequestType.GetFileHashUtilization;
	hash: Uint8Array;
};
export type AddFileRequest = {
	type: RequestType.AddFile;
	url: string;
} & (
	{
		errorCode: number;
		hash: null;
	} |
	{
		errorCode: null;
		hash: Uint8Array;
	}
);
export type GetLastMessageIDRequest = {
	type: RequestType.GetLastMessageID;
	channelID: string;
};
export type GetGuildsRequest = {
	type: RequestType.GetGuilds;
};
export type SearchMessagesRequest = {
	type: RequestType.SearchMessages;
	query: string;
	startDelimiter: string;
	endDelimiter: string;
};

export type SingleRequest =
	CommandRequest |
	AddUserSnapshotRequest |
	SyncDeletedGuildSubObjectsRequest |
	AddGuildSnapshotRequest |
	AddRoleSnapshotRequest |
	MarkRoleAsDeletedRequest |
	SyncGuildMembersRequest |
	AddMemberSnapshotFromFullRequest |
	AddMemberSnapshotFromPartialRequest |
	AddMemberLeaveRequest |
	AddChannelSnapshotRequest |
	MarkChannelAsDeletedRequest |
	AddThreadSnapshotRequest |
	MarkThreadAsDeletedRequest |
	AddMessageSnapshotRequest |
	MarkMessageAsDeletedRequest |
	AddInitialReactionsRequest |
	AddReactionPlacementRequest |
	MarkReactionAsRemovedRequest |
	MarkReactionAsRemovedBulkRequest |
	AddGuildEmojiSnapshotRequest |
	MarkGuildEmojiAsDeletedRequest |
	UpdateEmojiUploadersRequest |
	CheckForMissingEmojiUploadersRequest |
	GetGuildEmojisRequest |
	GetFileRequest |
	GetFileHashUtilizationRequest |
	AddFileRequest |
	GetLastMessageIDRequest;
export type IteratorRequest =
	GetGuildsRequest |
	GetRolesRequest |
	GetChannelsRequest |
	GetThreadsRequest |
	GetForumTagsRequest |
	GetMessagesRequest |
	GetGuildEmojisRequest |
	GetFilesRequest |
	SearchMessagesRequest;

export type File = {
	url: string;
	hash: Uint8Array | null;
	errorCode: number | null;
};

export type SingleResponseFor<R extends SingleRequest> =
	R extends CommandRequest ? void :
	R extends AddUserSnapshotRequest ? AddSnapshotResult :
	R extends SyncDeletedGuildSubObjectsRequest ? void :
	R extends AddGuildSnapshotRequest ? AddSnapshotResult :
	R extends AddRoleSnapshotRequest ? AddSnapshotResult :
	R extends MarkRoleAsDeletedRequest ? boolean :
	R extends SyncGuildMembersRequest ? void :
	R extends AddMemberSnapshotFromFullRequest ? AddSnapshotResult :
	R extends AddMemberSnapshotFromPartialRequest ? AddSnapshotResult :
	R extends AddMemberLeaveRequest ? AddSnapshotResult :
	R extends AddChannelSnapshotRequest ? AddSnapshotResult :
	R extends MarkChannelAsDeletedRequest ? boolean :
	R extends AddThreadSnapshotRequest ? AddSnapshotResult :
	R extends MarkThreadAsDeletedRequest ? boolean :
	R extends AddMessageSnapshotRequest ? AddSnapshotResult :
	R extends MarkMessageAsDeletedRequest ? boolean :
	R extends AddInitialReactionsRequest ? void :
	R extends AddReactionPlacementRequest ? void :
	R extends MarkReactionAsRemovedRequest ? void :
	R extends MarkReactionAsRemovedBulkRequest ? void :
	R extends AddGuildEmojiSnapshotRequest ? AddSnapshotResult :
	R extends MarkGuildEmojiAsDeletedRequest ? boolean :
	R extends UpdateEmojiUploadersRequest ? void :
	R extends CheckForMissingEmojiUploadersRequest ? boolean:
	R extends GetFileRequest ? Omit<File, "url"> | undefined :
	R extends GetFileHashUtilizationRequest ? boolean :
	R extends AddFileRequest ? boolean :
	R extends GetLastMessageIDRequest ? bigint | null :
	never;

export type SnapshotResponse<T> = {
	/**
	 * The timing at which the snapshot was taken, or `null` if the snapshot depicts the state of
	 * the object upon creation.
	 *
	 * For messages, the `timestamp` property corresponds to `edited_timestamp` and the `realtime`
	 * property is always set to `true`.
	 */
	timing: Timing | null;
	/** The timing at which the object was deleted or found to be deleted. */
	deletedTiming: Timing | null;
	data: T;
};

export type IteratorResponseFor<R extends IteratorRequest> =
	R extends GetFilesRequest ? File :
	R extends GetGuildsRequest ? SnapshotResponse<DT.Guild> :
	R extends GetRolesRequest ? SnapshotResponse<DT.Role> :
	R extends GetChannelsRequest ? SnapshotResponse<Omit<DT.DirectChannel | DT.GuildChannel, "available_tags">> :
	R extends GetThreadsRequest ? SnapshotResponse<DT.Thread> :
	R extends GetForumTagsRequest ? SnapshotResponse<DT.ForumTag> :
	R extends GetMessagesRequest ? SnapshotResponse<DT.Message> :
	R extends GetGuildEmojisRequest ? SnapshotResponse<CustomEmojiData> :
	R extends SearchMessagesRequest ? {
		_timestamp: bigint;
		_deleted: bigint | null;
		id: bigint;
		content: string;
		flags: bigint;
		embeds: string;
		user_id: bigint;
		username: string | null;
		discriminator: string | null;
		channel_id: bigint;
		channel_name: string | null;
		parent_channel_id: bigint | null;
		parent_channel_name: string | null;
		guild_id: bigint;
		guild_name: string | null;
	} :
	never;
