import * as DT from "../discord-api/types.js";

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
	Optimize,
	Vacuum,
	AddUserSnapshot,
	SyncGuildChannelsAndRoles,
	AddGuildSnapshot,
	SyncGuildMembers,
	AddMemberSnapshot,
	AddMemberLeave,
	AddRoleSnapshot,
	MarkRoleAsDeleted,
	AddChannelSnapshot,
	MarkChannelAsDeleted,
	AddMessageSnapshot,
	MarkMessageAsDeleted,
	AddInitialReactions,
	AddReactionPlacement,
	MarkReactionAsRemoved,
	MarkReactionsAsRemovedBulk,
	GetFile,
	GetFiles,
	GetFileHashUtilization,
	AddFile,
	GetLastMessageID,
	GetGuilds,
	GetDMChannels,
	GetGuildChannels,
	GetChannelMessages,
	CountChannelMessages,
	SearchMessages,
}

// `timing === null` indicates that the snapshot depicts the state of the object upon creation.

export type CommandRequest = {
	type: RequestType.Close | RequestType.BeginTransaction | RequestType.CommitTransaction | RequestType.Optimize | RequestType.Vacuum;
};
export type AddUserSnapshotRequest = {
	type: RequestType.AddUserSnapshot;
	timing: Timing | null;
	user: DT.PartialUser;
};
export type SyncGuildChannelsAndRolesRequest = {
	type: RequestType.SyncGuildChannelsAndRoles;
	timing: Timing;
	guildID: bigint;
	channelIDs: Set<bigint>;
	roleIDs: Set<bigint>;
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
	channel: DT.Channel;
};
export type MarkChannelAsDeletedRequest = {
	type: RequestType.MarkChannelAsDeleted;
	timing: Timing;
	id: string;
};
export type AddMessageSnapshotRequest = {
	type: RequestType.AddMessageSnapshot;
	message: DT.Message;
};
export type MarkMessageAsDeletedRequest = {
	type: RequestType.MarkMessageAsDeleted;
	timing: Timing;
	id: string;
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
export type GetDMChannelsRequest = {
	type: RequestType.GetDMChannels;
};
export type GetGuildChannelsRequest = {
	type: RequestType.GetGuildChannels;
	guildID: string;
};
export type GetChannelMessagesRequest = {
	type: RequestType.GetChannelMessages;
	channelID: string;
};
export type CountChannelMessagesRequest = {
	type: RequestType.CountChannelMessages;
	channelID: string;
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
	SyncGuildChannelsAndRolesRequest |
	AddGuildSnapshotRequest |
	AddRoleSnapshotRequest |
	MarkRoleAsDeletedRequest |
	SyncGuildMembersRequest |
	AddMemberSnapshotFromFullRequest |
	AddMemberSnapshotFromPartialRequest |
	AddMemberLeaveRequest |
	AddChannelSnapshotRequest |
	MarkChannelAsDeletedRequest |
	AddMessageSnapshotRequest |
	MarkMessageAsDeletedRequest |
	AddInitialReactionsRequest |
	AddReactionPlacementRequest |
	MarkReactionAsRemovedRequest |
	MarkReactionAsRemovedBulkRequest |
	GetFileRequest |
	GetFileHashUtilizationRequest |
	AddFileRequest |
	GetLastMessageIDRequest |
	CountChannelMessagesRequest;
export type IteratorRequest =
	GetFilesRequest |
	GetGuildsRequest |
	GetDMChannelsRequest |
	GetGuildChannelsRequest |
	GetChannelMessagesRequest |
	SearchMessagesRequest;

export type File = {
	url: string;
	hash: Uint8Array | null;
	errorCode: number | null;
};

export type ResponseFor<R extends SingleRequest> =
	R extends CommandRequest ? void :
	R extends AddUserSnapshotRequest ? AddSnapshotResult :
	R extends SyncGuildChannelsAndRolesRequest ? void :
	R extends AddGuildSnapshotRequest ? AddSnapshotResult :
	R extends AddRoleSnapshotRequest ? AddSnapshotResult :
	R extends MarkRoleAsDeletedRequest ? boolean :
	R extends SyncGuildMembersRequest ? void :
	R extends AddMemberSnapshotFromFullRequest ? AddSnapshotResult :
	R extends AddMemberSnapshotFromPartialRequest ? AddSnapshotResult :
	R extends AddMemberLeaveRequest ? AddSnapshotResult :
	R extends AddChannelSnapshotRequest ? AddSnapshotResult :
	R extends MarkChannelAsDeletedRequest ? boolean :
	R extends AddMessageSnapshotRequest ? AddSnapshotResult :
	R extends MarkMessageAsDeletedRequest ? boolean :
	R extends AddInitialReactionsRequest ? void :
	R extends AddReactionPlacementRequest ? void :
	R extends MarkReactionAsRemovedRequest ? void :
	R extends MarkReactionAsRemovedBulkRequest ? void :
	R extends GetFileRequest ? Omit<File, "url"> | undefined :
	R extends GetFileHashUtilizationRequest ? boolean :
	R extends AddFileRequest ? boolean :
	R extends GetLastMessageIDRequest ? bigint | null :
	R extends CountChannelMessagesRequest ? bigint | null :
	never;

export type DeletableLatestSnapshotTimings = {
	timing: Timing | null;
	deletedTiming: Timing | null;
};

export type IteratorResponseFor<R extends IteratorRequest> =
	R extends GetFilesRequest ? File :
	R extends GetGuildsRequest ? DeletableLatestSnapshotTimings & {
		guild: DT.Guild;
	} :
	R extends GetDMChannelsRequest ? DeletableLatestSnapshotTimings & {
		channel: DT.GuildChannel;
	} :
	R extends GetGuildChannelsRequest ? DeletableLatestSnapshotTimings & {
		channel: DT.GuildChannel;
	} :
	R extends GetChannelMessagesRequest ? DeletableLatestSnapshotTimings & {
		message: DT.Message;
	} :
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
