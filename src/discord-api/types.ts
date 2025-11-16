// This file contains modified content from the [official Discord documentation](https://discord.com/developers/docs) and the
// [Discord Unofficial User API Documentation project](https://github.com/discord-userdoccers/discord-userdoccers),
// both licensed under the
// [Creative Commons Attribution-ShareAlike 4.0 International license](https://creativecommons.org/licenses/by-sa/4.0/).
// This file, but not the rest of the project, is licensed under the same license.

/**
 * @fileoverview Type definitions for the Discord API
 *
 * This is only a subset of the available API. Not only are some objects missing, but there are
 * also some properties missing, which are irrelevant for our use cases.
 */

//#region Users

export type AvatarDecorationData = {
	/** The avatar decoration hash */
	asset: string;
	/** ID of the avatar decoration's SKU */
	sku_id: string;
	/** Unix timestamp of when the current avatar decoration expires */
	expires_at: number | null;
};

export type PrimaryGuild = {
	/** The ID of the user's primary guild */
	identity_guild_id: string | null;
	/**
	 * Whether the user is displaying the primary guild's server tag
	 *
	 * This can be `null` if the system clears the identity, e.g. the server no longer supports
	 * tags. This will be `false` if the user manually removes their tag. */
	identity_enabled: boolean | null;
	/**
	 * The text of the user's server tag
	 *
	 * Limited to 4 characters.
	 */
	tag: string | null;
	/** The server tag badge hash */
	badge: string | null;
};

export type Nameplate = {
	/** The nameplate asset path */
	asset: string;
	/** The ID of the nameplate's SKU */
	sku_id: string;
	/** The nameplate's accessibility description */
	label: string;
	/** The nameplate's color palette */
	palette: string;
	/** Unix timestamp of when the current nameplate expires */
	expires_at?: number | null;
};
export type Collectibles = {
	nameplate?: Nameplate;
};

export type DisplayNameStyle = {
	/** The font to use */
	font_id: number;
	/** The effect to use */
	effect_id: number;
	/** The colors to use encoded as an array of integers representing hexadecimal color codes */
	colors: number[];
};

export type PartialUser = {
	/** The user's ID */
	id: string;
	/** The user's username, not unique across the platform */
	username: string;
	/** The 4 digits after the `#` in the tag. Set to `"0"` for the new usernames without discriminators */
	discriminator: string;
	/** The user's display name, if it is set. For bots, this is the application name */
	global_name: string | null;
	/** The user's avatar hash */
	avatar: string | null;
	/** The user's display name style */
	display_name_styles?: DisplayNameStyle | null;
	linked_users?: unknown;
	/** Whether the user belongs to an OAuth2 application */
	bot?: boolean;
	/** Whether the user is an Official Discord System user (part of the urgent message system) */
	system?: boolean;
	/** The user's banner color encoded as an integer representation of a hexadecimal color code */
	accent_color?: number | null;
	/**
	 * The flags on a user's account
	 *
	 * This should be equal to `public_flags`.
	 */
	flags?: number;
	/** The public flags on a user's account */
	public_flags?: number;
	/** The data for the user's avatar decoration */
	avatar_decoration_data?: AvatarDecorationData | null;
	/** Data for the user's collectibles */
	collectibles?: Collectibles | null;
	/** @deprecated */
	clan?: PrimaryGuild | null;
	/** The user's primary guild */
	primary_guild?: PrimaryGuild | null;
	display_name?: unknown;
};

/**
 * User object returned from the `/users/{id}` and `/users/{id}/profile` endpoints
 *
 * Some of these additional properties may also be present on partial user objects but they might
 * be incorrectly set to `null`.
 */
export type User = PartialUser & {
	/** The user's banner hash */
	banner?: string | null;
	banner_color?: unknown;
	/** The user's banner color encoded as an integer representation of hexadecimal color code */
	accent_color?: number | null;
	pronouns?: string;
	bio?: string;
};

//#endregion


//#region Applications

type Application = {
	id: string;
	// TODO
};

//#endregion


//#region Attachments

export const enum AttachmentFlag {
	None = 0,
	/** This attachment has been edited using the remix feature on mobile */
	IsRemix = 1 << 2,
}

export type Attachment = {
	/** Attachment ID */
	id: string;
	/** Name of file attached */
	filename: string;
	/** The original filename (before special characters get replaced) without the file extension */
	title?: string;
	/** Description for the file */
	description?: string;
	/** The attachment's media type */
	content_type?: string;
	// Undocumented
	original_content_type?: string;
	/** Size of file in bytes */
	size: number;
	/** Source url of file */
	url: string;
	/** A proxied url of file */
	proxy_url: string;
	/** Height of file (if image) */
	height?: number | null;
	/** Width of file (if image) */
	width?: number | null;
	/** The version of the explicit content scan filter this attachment was scanned with */
	content_scan_version?: number;
	/** The attachment placeholder protocol version (currently 1) */
	placeholder_version?: number;
	/** A low-resolution thumbhash of the attachment, to display before it is loaded */
	placeholder?: string;
	/** Whether this attachment is ephemeral */
	ephemeral?: boolean;
	/** The duration of the audio file (currently for voice messages) */
	duration_secs?: number;
	/** Base64 encoded byte array representing a sampled waveform (currently for voice messages) */
	waveform?: string;
	/** Attachment flags combined as a bitfield */
	flags?: AttachmentFlag;
	// `is_*` fields are send-only
	/** The IDs of the participants in the clip (max 100) */
	clip_created_at?: boolean;
	// `clip_participant_ids` is send-only
	/** The participants in the clip (max 100) */
	clip_participants?: boolean;
	// `application_id` is send-only
	/** The application the clip was taken in */
	application?: Application;
};

export const enum InteractionType {
	Ping = 1,
	ApplicationCommand = 2,
	MessageComponent = 3,
	ApplicationCommandAutocomplete = 4,
	ModalSubmit = 5,
}

//#endregion

//#region Messages

export const enum MessageType {
	Default = 0,
	RecipientAdd = 1,
	RecipientRemove = 2,
	Call = 3,
	ChannelNameChange = 4,
	ChannelIconChange = 5,
	ChannelPinnedMessage = 6,
	UserJoin = 7,
	GuildBoost = 8,
	GuildBoostTier1 = 9,
	GuildBoostTier2 = 10,
	GuildBoostTier3 = 11,
	ChannelFollowAdd = 12,
	GuildDiscoveryDisqualified = 14,
	GuildDiscoveryRequalified = 15,
	GuildDiscoveryGracePeriodInitialWarning = 16,
	GuildDiscoveryGracePeriodFinalWarning = 17,
	ThreadCreated = 18,
	Reply = 19,
	ChatInputCommand = 20,
	ThreadStarterMessage = 21,
	GuildInviteReminder = 22,
	ContextMenuCommand = 23,
	AutoModerationAction = 24,
	RoleSubscriptionPurchase = 25,
	InteractionPremiumUpsell = 26,
	StageStart = 27,
	StageEnd = 28,
	StageSpeaker = 29,
	StageRaiseHand = 30,
	StageTopic = 31,
	GuildApplicationPremiumSubscription = 32,
	GuildIncidentAlertModeEnabled = 36,
	GuildIncidentAlertModeDisabled = 37,
	GuildIncidentReportRaid = 38,
	GuildIncidentReportFalseAlarm = 39,
	PurchaseNotification = 44,
	PollResult = 46,
}

export const enum MessageFlag {
	None = 0,
	/** This message has been published to subscribed channels (via Channel Following) */
	Crossposted = 1 << 0,
	/** This message originated from a message in another channel (via Channel Following) */
	IsCrosspost = 1 << 1,
	/** Do not include any embeds when serializing this message */
	SuppressEmbeds = 1 << 2,
	/** The source message for this crosspost has been deleted (via Channel Following) */
	SourceMessageDeleted = 1 << 3,
	/** This message came from the urgent message system */
	Urgent = 1 << 4,
	/** This message has an associated thread, with the same ID as the message */
	HasThread = 1 << 5,
	/** This message is only visible to the user who invoked the Interaction */
	Ephemeral = 1 << 6,
	/** This message is an interaction response and the bot is "thinking" */
	Loading = 1 << 7,
	/** This message failed to mention some roles and add their members to the thread */
	FailedToMentionSomeRolesInThread = 1 << 8,
	/** This message will not trigger push and desktop notifications */
	SuppressNotifications = 1 << 12,
	/** This message is a voice message */
	IsVoiceMessage = 1 << 13,
	/** This message has a snapshot (via Message Forwarding) */
	HasSnapshot = 1 << 14,
	/** This message contains components from version 2 of the UI kit */
	IsComponentsV2 = 1 << 15,
}

export const enum ReactionType {
	Normal = 0,
	Burst = 1,
};

export type Reaction = {
	/** Total number of times this emoji has been used to react (including super reacts) */
	count: number;
	count_details: {
		/** Count of super reactions */
		burst: number;
		/** Count of normal reactions */
		normal: number;
	};
	/**
	 * Whether the current user reacted using this emoji
	 *
	 * Irrelevant.
	 */
	me: boolean;
	/**
	 * Whether the current user super-reacted using this emoji
	 *
	 * Irrelevant.
	 */
	me_burst: boolean;
	/** Emoji information */
	emoji: PartialEmoji;
	/** Colors used for super reaction, encoded in hex format */
	burst_colors: string[];
};

export const enum MessageActivityType {
	Join = 1,
	Spectate = 2,
	Listen = 3,
	JoinRequest = 5,
}

export type MessageActivity = {
	/** Type of message activity */
	type: MessageActivityType;
	/** `party_id` from a Rich Presence event */
	party_id: string;
};

export const enum MessageReferenceType {
	/** Reply: `referenced_message` contains information about the message being replied to. */
	Default,
	/** Forwarded message: `message_snapshot` contains information about the original message. */
	Forward,
}

export type MessageReference = {
	/** Type of reference */
	type?: MessageReferenceType;
	/** ID of the originating message */
	message_id?: string;
	/** ID of the originating message's channel */
	channel_id?: string;
	/** ID of the originating message's guild */
	guild_id?: string;
};

export type EmbedMedia = {
	/** Source URL of media */
	url?: string;
	/** A proxied URL of the media */
	proxy_url?: string;
	/** Height of media */
	height?: number;
	/** Width of media */
	width?: number;
	/** The media's attachment flags */
	flags?: number;
	/** Alt text for the media */
	description?: string;
	/** The attachment's media type */
	content_type?: string;
	/** The content scan metadata for the media */
	content_scan_metadata?: Record<string, unknown>;
	/** The attachment placeholder protocol version */
	placeholder_version?: number;
	/** A low-resolution thumbhash of the media, to display before it is loaded */
	placeholder?: string;
};
export type Embed = {
	/** Title of embed */
	title?: string;
	/** Type of embed (always "rich" for webhook embeds) */
	type?:
		"rich" |
		"image" |
		"video" |
		"gifv" |
		"article" |
		"link" |
		"poll_result" |
		"auto_moderation_notification";
	/** Description of embed */
	description?: string;
	/** URL of embed */
	url?: string;
	/** Timestamp of embed content */
	timestamp?: string;
	/** Color code of the embed */
	color?: number;
	/** Footer information */
	footer?: {
		/** Footer text */
		text: string;
		/** URL of footer icon */
		icon_url?: string;
		/** A proxied URL of footer icon */
		proxy_icon_url?: string;
	};
	/** Image information */
	image?: EmbedMedia;
	/** Thumbnail information */
	thumbnail?: EmbedMedia;
	/** Video information */
	video?: EmbedMedia;
	/** Provider information */
	provider?: {
		/** Name of provider */
		name?: string;
		/** URL of provider */
		url?: string;
	};
	/** Author information */
	author?: {
		/** Name of author */
		name: string;
		/** URL of author */
		url?: string;
		/** URL of author icon */
		icon_url?: string;
		/** A proxied URL of author icon */
		proxy_icon_url?: string;
	};
	/** Fields information, max of 25 */
	fields?: {
		/** Name of the field */
		name: string;
		/** Value of the field */
		value: string;
		/** Whether or not this field should display inline */
		inline?: boolean;
	}[];
	/** The ID of the message this embed was generated from */
	reference_id?: string;
	/** The version of the explicit content scan filter this embed was scanned with */
	content_scan_version?: number;
	/** The embed's flags */
	flags?: number;
};

export type MessageInteractionMetadata = {
	/** ID of the interaction */
	id: string;
	/** Type of interaction */
	type: InteractionType;
	/**
	 * The name of the application command executed (including subcommands and subcommand groups),
	 * present only on `APPLICATION_COMMAND` interactions
	 */
	name?: string;
	/**
	 * The type of application command executed, present only on APPLICATION_COMMAND interactions
	 */
	command_type?: number;
	/** The reason this interaction is ephemeral */
	ephemerality_reason?: number;
	/** User who triggered the interaction */
	user: PartialUser;
	/**
	 * IDs for installation context(s) related to an interaction
	 *
	 * Irrelevant.
	 */
	authorizing_integration_owners: unknown;
	/** ID of the original response message, present only on follow-up messages */
	original_response_message_id?: string;
	/**
	 * ID of the message that contained interactive component, present only on messages created from
	 * component interactions
	 */
	interacted_message_id?: string;
	/**
	 * Metadata for the interaction that was used to open the modal, present only on MODAL_SUBMIT
	 * interactions
	 */
	triggering_interaction_metadata?: MessageInteractionMetadata;
	/** The user the command was run on, present only on user command interactions */
	target_user?: PartialUser;
	/**
	 * The ID of the message the command was run on, present only on message command interactions
	 *
	 * The original response message will also have `message_reference` and `referenced_message`
	 * pointing to this message.
	 */
	target_message_id?: string;
};

export type Message = {
	/** ID of the message */
	id: string;
	/** ID of the channel the message was sent in */
	channel_id: string;
	/** The author of this message (not guaranteed to be a valid user if the message was sent by a webhook) */
	author: PartialUser;
	/** Text content of the message */
	content: string;
	/** When this message was sent */
	timestamp: string;
	/** When this message was edited (or null if never) */
	edited_timestamp: string | null;
	/** Whether this was a text-to-speech message */
	tts: boolean;
	/** Whether this message mentions everyone */
	mention_everyone: boolean;
	/** Users specifically mentioned in the message */
	mentions: PartialUser[];
	/** Roles specifically mentioned in this message */
	mention_roles: string[];
	/** Channels specifically mentioned in this message */
	mention_channels?: unknown[];
	/** Any attached files */
	attachments: Attachment[];
	/** Any embedded content */
	embeds: Embed[];
	/** Reactions to the message */
	reactions?: Reaction[];
	/** Whether this message is pinned */
	pinned: boolean;
	/** If the message is generated by a webhook, this is the webhook's ID */
	webhook_id?: string;
	/** Type of message */
	type: MessageType;
	/** Sent with Rich Presence-related chat embeds */
	activity?: MessageActivity;
	/** Sent with Rich Presence-related chat embeds */
	application?: Application;
	/** If the message is a response to an Interaction, this is the ID of the interaction's application */
	application_id?: string;
	/** Reference data sent with crossposted messages, replies, pins, and thread starter messages */
	message_reference?: MessageReference;
	/** Message flags combined as a bitfield */
	flags?: MessageFlag;
	/**
	 * The message associated with the `message_reference`
	 *
	 * If the message is a reply but the `referenced_message` field is not present, the backend did
	 * not attempt to fetch the message that was being replied to, so its state is unknown. If the
	 * field exists but is `null`, the referenced message was deleted.
	 */
	referenced_message?: Message | null;
	interaction?: {
		/** ID of the interaction */
		id: string;
		/** Type of interaction */
		type: InteractionType;
		/** Name of the application command, including subcommands and subcommand groups */
		name: string;
		/** User who triggered the interaction */
		user: PartialUser;
		/** Member who triggered the interaction in the guild */
		member?: GuildMember;
	};
	/**
	 * Sent if the message is sent as a result of an interaction
	 */
	interaction_metadata?: MessageInteractionMetadata;
	/** Sent if a thread was started from this message */
	thread?: Channel;
	/** Sent if the message contains components like buttons, action rows, or other interactive components */
	components?: unknown[];
	/** Sent if the message contains stickers */
	sticker_items?: StickerItem[];
	/**
	 * The stickers sent with the message
	 * @deprecated
	 */
	stickers?: Sticker[];
	/**
	 * A generally increasing integer (there may be gaps or duplicates) that represents the approximate position of the message in a thread
	 *
	 * It can be used to estimate the relative position of the message in a thread in company with `total_message_sent` on parent thread.
	 */
	position?: number;
	/** Data of the role subscription purchase or renewal that prompted this `ROLE_SUBSCRIPTION_PURCHASE` message */
	role_subscription_data?: unknown;
	/**
	 * Data for users, members, channels, and roles in the message's auto-populated select menus
	 *
	 * Irrelevant.
	 */
	resolved?: unknown;
	/** A poll! */
	poll?: unknown;
	/**
	 * The message associated with the message_reference. This is a minimal subset of fields in a message (e.g. author is excluded.)
	 *
	 * Irrelevant.
	 */
	message_snapshots?: {
		message: SnapshotMessage;
	}[];
	/** The call associated with the message */
	call?: {
		/** Array of user object ids that participated in the call */
		participants: string[];
		/** Time when call ended */
		ended_timestamp: string;
	};
	/** Sent with activity invitations */
	activity_instance?: unknown;
	/** The message's soundboard sounds */
	soundboard_sounds?: unknown[];
};

type SnapshotMessageKeys =
	"content" |
	"timestamp" |
	"edited_timestamp" |
	"mentions" |
	"mention_roles" |
	"attachments" |
	"embeds" |
	"type" |
	"flags" |
	"components" |
	"resolved" |
	"sticker_items" |
	"soundboard_sounds";
export type SnapshotMessage = Pick<Message, SnapshotMessageKeys> & Partial<Record<Exclude<keyof Message, SnapshotMessageKeys>, never>>;

//#endregion

//#region Stickers

export type StickerItem = Pick<Sticker, "format_type" | "id" | "name">;
export type Sticker = {
	/** ID of the sticker */
	id: string;
	/** For standard stickers, ID of the pack the sticker is from */
	pack_id?: string;
	/** Name of the sticker */
	name: string;
	/** Description of the sticker */
	description: string | null;
	/** For guild stickers, the Discord name of a unicode emoji representing the sticker's expression. for standard stickers, a comma-separated list of related expressions. */
	tags: string;
	/** Type of sticker */
	type: StickerType;
	/** Type of sticker format */
	format_type: StickerFormatType;
	/** Whether this guild sticker can be used, may be false due to loss of Server Boosts */
	available?: boolean;
	/** ID of the guild that owns this sticker */
	guild_id?: string;
	/** The user that uploaded the guild sticker */
	user?: PartialUser;
	/** The standard sticker's sort order within its pack */
	sort_value?: number;
};

export const enum StickerType {
	/** An official sticker in a pack */
	Standard = 1,
	/** A sticker uploaded to a guild for the guild's members */
	Guild = 2,
}

export const enum StickerFormatType {
	PNG = 1,
	APNG = 2,
	Lottie = 3,
	GIF = 4,
}

//#endregion


//#region Emojis

export type PartialCustomEmoji = {
	/** Emoji ID */
	id: string;
	/** Emoji name (can be null only in reaction emoji objects) */
	name: string;
	/** Whether this emoji is animated */
	animated?: boolean;
};
export type PartialUnicodeEmoji = {
	/** Emoji ID */
	id: null;
	/** Emoji name (can be null only in reaction emoji objects) */
	name: string;
};
export type PartialEmoji = PartialCustomEmoji | PartialUnicodeEmoji;

export type CustomEmoji = PartialCustomEmoji & {
	/** IDs of roles allowed to use this emoji */
	roles?: string[];
	/** User that created this emoji */
	user?: PartialUser;
	/** Whether this emoji must be wrapped in colons */
	require_colons?: boolean;
	/** Whether this emoji is managed */
	managed?: boolean;
	/**
	 * Whether this emoji can be used
	 *
	 * May be false due to loss of Server Boosts.
	 */
	available?: boolean;
};

export type CustomEmojiFields = {
	/** The ID of a guild's custom emoji */
	emoji_id: string;
	/** The unicode character of the emoji */
	emoji_name: null;
};
export type UnicodeEmojiFields = {
	/** The ID of a guild's custom emoji */
	emoji_id: null;
	/** The unicode character of the emoji */
	emoji_name: string;
};
export type AbsentEmojiFields = {
	/** The ID of a guild's custom emoji */
	emoji_id: null;
	/** The unicode character of the emoji */
	emoji_name: null;
};
export type EmojiFields = CustomEmojiFields | UnicodeEmojiFields;
export type OptionalEmojiFields = EmojiFields | AbsentEmojiFields;

//#endregion


//#region Channels

export const enum ChannelType {
	/** A text channel within a guild */
	GuildText = 0,
	/** A direct message between users */
	DM = 1,
	/** A voice channel within a guild */
	GuildVoice = 2,
	/** A direct message between multiple users */
	GroupDM = 3,
	/** An organizational category that contains up to 50 channels */
	GuildCategory = 4,
	/** A channel that users can follow and crosspost into their own server (formerly news channels) */
	GuildAnnouncement = 5,
	/** A temporary sub-channel within a guild announcement channel */
	AnnouncementThread = 10,
	/** A temporary sub-channel within a guild text or guild forum channel */
	PublicThread = 11,
	/**
	 * A temporary sub-channel within a guild text channel that is only viewable by those invited
	 * and those with the manage threads permission
	 */
	PrivateThread = 12,
	/** A voice channel for hosting events with an audience */
	GuildStageVoice = 13,
	/** The channel in a hub containing the listed servers */
	GuildDirectory = 14,
	/** A channel that can only contain threads */
	GuildForum = 15,
	/** A channel that can only contain threads, similar to guild forum channels */
	GuildMedia = 16,
}

export const enum PermissionOverwriteType {
	Role = 0,
	Member = 1,
}

export type PermissionOverwrite = {
	/** Role or user ID */
	id: string;
	/** The type of permission overwrite */
	type: PermissionOverwriteType;
	/** Bit set of allowed permissions, represented in decimal */
	allow: string;
	/** Bit set of denied permissions, represented in decimal */
	deny: string;
};

export type ThreadMetadata = {
	/** Whether the thread is archived */
	archived: boolean;
	/**
	 * The thread will stop showing in the channel list after `auto_archive_duration` minutes of
	 * inactivity. Can be set to: 60, 1440, 4320, 10080.
	 */
	auto_archive_duration: number;
	/** Timestamp of when the thread's archive status was last changed, used for calculating recent activity */
	archive_timestamp: string;
	/**
	 * Whether the thread is locked
	 *
	 * When a thread is locked, only users with the manage threads permission can unarchive it.
	 */
	locked: boolean;
	/**
	 * Whether non-moderators can add other non-moderators to a thread
	 *
	 * Only available on private threads.
	 */
	invitable?: boolean;
	/**
	 * Timestamp when the thread was created
	 *
	 * Only populated for threads created after 2022-01-09.
	 */
	create_timestamp?: string;
};

export type ForumTag = {
	/** The ID of the tag */
	id: string;
	/** The name of the tag (0-20 characters) */
	name: string;
	/** Whether this tag can only be added to or removed from threads by a member with the manage threads permission */
	moderated: boolean;
	color?: unknown;
} & OptionalEmojiFields;

export type DefaultReaction = EmojiFields;

type ChannelCommonFields<T extends ChannelType> = {
	/** The ID of this channel */
	id: string;
	type: T;
	/**
	 * Channel flags combined as a bitfield
	 *
	 * Represented here as a number because no flags are currently relevant to the archiver.
	 */
	flags: number;
};

type TextChannelFields = {
	/** The channel topic (0-4096 characters for GUILD_FORUM and GUILD_MEDIA channels, 0-1024 characters for all others) */
	topic?: string | null;
	/** Whether the channel is nsfw */
	nsfw?: boolean;
	/**
	 * The ID of the last message sent in this channel (or thread for guild forum or guild media
	 * channels) (may not point to an existing or valid message or thread)
	 */
	last_message_id?: string | null;
	/**
	 * When the last pinned message was pinned
	 *
	 * This may be `null` in events such as guild create when a message is not pinned.
	 */
	last_pin_timestamp?: string | null;
	/**
	 * Amount of seconds a user has to wait before sending another message (0-21600)
	 *
	 * Bots, as well as users with the permission manage messages or manage channel, are unaffected.
	 */
	rate_limit_per_user?: number;
	/**
	 * Default duration, copied onto newly created threads, in minutes, threads will stop showing in
	 * the channel list after the specified period of inactivity
	 *
	 * Can be set to: 60, 1440, 4320, 10080.
	 */
	default_auto_archive_duration?: number;
	/**
	 * Only included when part of the resolved data received on a slash command interaction.
	*/
	permissions?: string;
	default_thread_rate_limit_per_user?: number;
};

type DMChannelFields = {
	// TODO: Probably missing last_message_id
	/** The recipients of the DM */
	recipients: PartialUser[];
};

type GroupDMChannelFields = {
	/** Icon hash of the group DM */
	icon?: string | null;
	/** ID of the creator of the group DM */
	owner_id?: string;
	/** Application ID of the group DM creator if it is bot-created */
	application_id?: string;
	/** For group DM channels: whether the channel is managed by an application via the `gdm.join` OAuth2 scope */
	managed?: boolean;
};

type GuildChannelFields = {
	/** The name of the channel (1-100 characters) */
	name: string;
	/** ID of the parent category for a channel */
	parent_id?: string | null;
	/** Explicit permission overwrites for members and roles */
	permission_overwrites?: PermissionOverwrite[];
	/** Sorting position of the channel */
	position: number;
	/** The emoji to show next to the channel name in channels list */
	icon_emoji?: PartialEmoji;
	/** The background color of the channel icon emoji encoded as an integer representation of a hexadecimal color code */
	theme_color?: number | null;
};

type GuildIDChannelFields = {
	/**
	 * The ID of the guild
	 *
	 * May be missing for some channel objects received over gateway guild dispatches, but these
	 * type definitions assume any channel with `guild_id` set is a guild channel.
	 */
	guild_id: string;
};

type VoiceChannelFields = {
	/** Whether the channel is nsfw */
	nsfw?: boolean;
	/**
	 * The ID of the last message sent in this channel (or thread for guild forum or guild media
	 * channels) (may not point to an existing or valid message or thread)
	 */
	last_message_id: string | null;
	/** The bitrate (in bits) of the voice or stage channel */
	bitrate?: number;
	/** The user limit of the voice or stage channel */
	user_limit?: number;
	/** Voice region ID for the voice or stage channel, automatic when set to `null` */
	rtc_region?: string | null;
	/** The camera video quality mode of the voice or stage channel, `1` when not present */
	video_quality_mode?: number;
	/** The status of the voice channel (max 500 characters) */
	status?: string | null;
	/** When the HD streaming entitlement expires for the voice channel */
	hd_streaming_until?: string | null;
	/** The ID of the user who applied the HD streaming entitlement to the voice channel */
	hd_streaming_buyer_id?: string | null;
	/** The lobby linked to the channel */
	linked_lobby?: unknown;
	voice_background_display?: unknown;
};

type ThreadChannelFields = {
	/** The name of the channel (1-100 characters) */
	name: string;
	/**
	 * The ID of the last message sent in this channel (or thread for guild forum or guild media
	 * channels) (may not point to an existing or valid message or thread)
	 */
	last_message_id?: string | null;
	/**
	 * Amount of seconds a user has to wait before sending another message (0-21600)
	 *
	 * Bots, as well as users with the permission manage messages or manage channel, are unaffected.
	 */
	rate_limit_per_user: number;
	/** ID of the creator of the thread */
	owner_id: string;
	/** ID of the channel this thread was created from */
	parent_id: string;
	/**
	 * When the last pinned message was pinned
	 *
	 * This may be `null` in events such as guild create when a message is not pinned.
	 */
	last_pin_timestamp?: string | null;
	/**
	 * Number of messages (not including the initial message or deleted messages) in a thread
	 *
	 * For threads created before July 1, 2022, it's inaccurate when it's greater than 50.
	 */
	message_count?: number;
	/** An approximate count of users in a thread, stops counting at 50 */
	member_count?: number;
	/** Thread-specific fields not needed by other channels */
	thread_metadata: ThreadMetadata;
	/**
	 * Thread member object for the current user, if they have joined the thread
	 *
	 * Only included on certain API endpoints.
	 */
	member?: unknown;
	/**
	 * Number of messages ever sent in a thread
	 *
	 * It's similar to message_count on message creation, but will not decrement the number when a
	 * message is deleted.
	 */
	total_message_sent?: number;
	/**
	 * The IDs of the set of tags that have been applied to a thread in a guild forum or a guild
	 * media channel
	 */
	applied_tags?: string[];
};

type ForumChannelFields = {
	/** Whether the channel is nsfw */
	nsfw?: boolean;
	/**
	 * The ID of the last message sent in this channel (or thread for guild forum or guild media
	 * channels) (may not point to an existing or valid message or thread)
	 */
	last_message_id: string | null;
	/** The set of tags that can be used in a guild forum or a guild media channel */
	available_tags: ForumTag[];
	/**
	 * The emoji to show in the add reaction button on a thread in a guild forum or a guild media
	 * channel
	 */
	default_reaction_emoji?: DefaultReaction | null;
	default_sort_order?: number | null;
	default_forum_layout?: number;
	/**
	 * The default tag matching behavior
	 *
	 * Known possible values: `"match_some"`, `"match_all"`.
	 */
	default_tag_setting?: string;
	/** Probably the default content for new posts */
	template?: string;
};

export type GuildTextChannel = ChannelCommonFields<ChannelType.GuildText> & GuildChannelFields & TextChannelFields;
export type DMChannel = ChannelCommonFields<ChannelType.DM> & DMChannelFields;
export type GuildVoiceChannel = ChannelCommonFields<ChannelType.GuildVoice> & GuildChannelFields & VoiceChannelFields;
export type GroupDMChannel = ChannelCommonFields<ChannelType.GroupDM> & DMChannelFields & GroupDMChannelFields;
export type GuildCategoryChannel = ChannelCommonFields<ChannelType.GuildCategory> & GuildChannelFields;
export type GuildAnnouncementChannel = ChannelCommonFields<ChannelType.GuildAnnouncement> & GuildChannelFields & TextChannelFields;
export type AnnouncementThread = ChannelCommonFields<ChannelType.AnnouncementThread> & ThreadChannelFields;
export type PublicThread = ChannelCommonFields<ChannelType.PublicThread> & ThreadChannelFields;
export type PrivateThread = ChannelCommonFields<ChannelType.PrivateThread> & ThreadChannelFields;
export type GuildStageChannel = ChannelCommonFields<ChannelType.GuildStageVoice> & GuildChannelFields & VoiceChannelFields;
// TODO: Student hub directory channels? I don't know how those work.
export type GuildForumChannel = ChannelCommonFields<ChannelType.GuildForum> & GuildChannelFields & ForumChannelFields;
export type GuildMediaChannel = ChannelCommonFields<ChannelType.GuildMedia> & GuildChannelFields & ForumChannelFields;

export type DirectChannel =
	DMChannel |
	GroupDMChannel;

export type GuildChannel =
	GuildTextChannel |
	GuildVoiceChannel |
	GuildCategoryChannel |
	GuildAnnouncementChannel |
	GuildStageChannel |
	GuildForumChannel |
	GuildMediaChannel;

export type Thread =
	AnnouncementThread |
	PublicThread |
	PrivateThread;

export type Channel =
	DirectChannel |
	GuildChannel |
	Thread;

export type ThreadMember = {
	/** Thread ID */
	id: string;
	user_id: string;
	join_timestamp: string;
	flags: number;
};

export function isDirectChannelType(type: ChannelType): boolean {
	return (
		type === ChannelType.DM ||
		type === ChannelType.GroupDM
	);
}
export function isGuildChannelType(type: ChannelType): boolean {
	return (
		type === ChannelType.GuildText ||
		type === ChannelType.GuildVoice ||
		type === ChannelType.GuildCategory ||
		type === ChannelType.GuildAnnouncement ||
		type === ChannelType.GuildStageVoice ||
		type === ChannelType.GuildForum ||
		type === ChannelType.GuildMedia
	);
}
export function isThreadType(type: ChannelType): boolean {
	return (
		type === ChannelType.AnnouncementThread ||
		type === ChannelType.PublicThread ||
		type === ChannelType.PrivateThread
	);
}

export function isDirectChannel(channel: Channel): channel is DirectChannel {
	return isDirectChannelType(channel.type);
}
export function isGuildChannel(channel: Channel): channel is GuildChannel {
	return isGuildChannelType(channel.type);
}
export function isThread(channel: Channel): channel is Thread {
	return isThreadType(channel.type);
}

//#endregion


//#region Guilds

export type UnavailableGuild = {
	id: string;
	unavailable?: boolean;
};

export const Permission = {
	CreateInstantInvite: 1n << 0n,
	KickMembers: 1n << 1n,
	BanMembers: 1n << 2n,
	Administrator: 1n << 3n,
	ManageChannels: 1n << 4n,
	ManageGuild: 1n << 5n,
	AddReactions: 1n << 6n,
	ViewAuditLog: 1n << 7n,
	PrioritySpeaker: 1n << 8n,
	Stream: 1n << 9n,
	ViewChannel: 1n << 10n,
	SendMessages: 1n << 11n,
	SendTTSMessages: 1n << 12n,
	ManageMessages: 1n << 13n,
	EmbedLinks: 1n << 14n,
	AttachFiles: 1n << 15n,
	ReadMessageHistory: 1n << 16n,
	MentionEveryone: 1n << 17n,
	UseExternalEmojis: 1n << 18n,
	ViewGuildInsights: 1n << 19n,
	Connect: 1n << 20n,
	Speak: 1n << 21n,
	MuteMembers: 1n << 22n,
	DeafenMembers: 1n << 23n,
	MoveMembers: 1n << 24n,
	UseVAD: 1n << 25n,
	ChangeNickname: 1n << 26n,
	ManageNicknames: 1n << 27n,
	ManageRoles: 1n << 28n,
	ManageWebhooks: 1n << 29n,
	ManageEmojisAndStickers: 1n << 30n,
	ManageGuildExpressions: 1n << 30n,
	UseApplicationCommands: 1n << 31n,
	RequestToSpeak: 1n << 32n,
	ManageEvents: 1n << 33n,
	ManageThreads: 1n << 34n,
	CreatePublicThreads: 1n << 35n,
	CreatePrivateThreads: 1n << 36n,
	UseExternalStickers: 1n << 37n,
	SendMessagesInThreads: 1n << 38n,
	UseEmbeddedActivities: 1n << 39n,
	ModerateMembers: 1n << 40n,
	ViewCreatorMonetizationAnalytics: 1n << 41n,
	UseSoundboard: 1n << 42n,
	CreateGuildExpressions: 1n << 43n,
	CreateEvents: 1n << 44n,
	UseExternalSounds: 1n << 45n,
	SendVoiceMessages: 1n << 46n,
	SendPolls: 1n << 49n,
	UseExternalApps: 1n << 50n,
};

export type Role = {
	id: string;
	name: string;
	/**
	 * The description for the role (max 90 characters)
	 *
	 * Experimental.
	 */
	description?: string;
	/** @deprecated */
	color: number;
	colors: unknown;
	/** Whether this role is pinned in the user listing */
	hoist: boolean;
	/** Icon hash */
	icon?: string | null;
	unicode_emoji?: string | null;
	position: number;
	permissions: string;
	/** Whether this role is managed by an integration */
	managed: boolean;
	mentionable: boolean;
	/**
	 * Role tags
	 *
	 * Properties with type `null` are set to `null` if true and absent if `false`.
	 */
	tags: {
		bot_id?: string;
		integration_id?: string;
		/** Whether this is the guild's booster role */
		premium_subscriber?: null;
		/** The ID of this role's subscription SKU and listing */
		subscription_listing_id?: string;
		available_for_purchase?: null;
		/** Whether this role is a guild's linked role */
		guild_connections?: null;
	};
	/**
	 * Role flags
	 *
	 * Typed as `number` since it's irrelevant to the archiving logic.
	 */
	flags: number;
};

// Doesn't include properties exclusive to templates
export type Guild = {
	id: string;
	name: string;
	/** Icon hash */
	icon: string | null;
	/** Splash image hash */
	splash: string | null;
	/** Discovery splash image hash */
	discovery_splash: string | null;
	owner?: boolean;
	owner_id: string;
	permissions?: string;
	/** @deprecated */
	region?: string | null;
	afk_channel_id: string | null;
	afk_timeout: number;
	widget_enabled?: boolean;
	widget_channel_id?: string | null;
	verification_level: number;
	default_message_notifications: number;
	explicit_content_filter: number;
	roles: Role[];
	emojis: CustomEmoji[];
	features: string[];
	mfa_level: number;
	/** Application ID of the guild creator if it is bot-created */
	application_id?: string | null;
	system_channel_id?: string | null;
	system_channel_flags: number;
	rules_channel_id: string | null;
	/**
	 * The maximum number of presences for the guild
	 *
	 * `null` is always returned, apart from the largest of guilds.
	 */
	max_presences?: number | null;
	/** The maximum number of members for the guild */
	max_members?: number;
	vanity_url_code: string | null;
	description: string | null;
	banner: string | null;
	premium_tier: number;
	premium_subscription_count?: number;
	preferred_locale: string;
	public_updates_channel_id: string | null;
	max_video_channel_users?: number;
	max_stage_video_channel_users?: number;
	approximate_member_count?: number;
	approximate_presence_count?: number;
	welcome_screen?: unknown;
	/** @deprecated */
	nsfw?: boolean;
	nsfw_level: number;
	stickers?: Sticker[];
	premium_progress_bar_enabled: boolean;
	safety_alerts_channel_id: string | null;
	incidents_data: unknown;
	profile: {
		/** The tag of the guild (2-4 characters) */
		tag: string;
		/** The guild badge hash */
		badge: string;
	} | null;
};

export const enum MemberFlag {
	None = 0,
	DidRejoin = 1 << 0,
	CompletedOnboarding = 1 << 1,
	BypassesVerification = 1 << 2,
	StartedOnboarding = 1 << 3,
	IsGuest = 1 << 4,
	StartedHomeActions = 1 << 5,
	CompletedHomeActions = 1 << 6,
	AutomodQuarantinedUsername = 1 << 7,
	DmSettingsUpsellAcknowledged = 1 << 9,
	AutomodQuarantinedGuildTag = 1 << 10,
}

export type GuildMember = {
	user: PartialUser;
	nick?: string | null;
	/** Avatar hash */
	avatar?: string | null;
	avatar_decoration_data?: AvatarDecorationData | null;
	collectibles?: Collectibles | null;
	display_name_styles?: DisplayNameStyle | null;
	/** The member's guild banner hash */
	banner?: string | null;
	/** Role IDs */
	roles: string[];
	joined_at: string;
	/** When the user started boosting the guild */
	premium_since?: string | null;
	deaf: boolean;
	mute: boolean;
	flags: MemberFlag;
	/** Whether the user has not yet passed the guild's Membership Screening requirements */
	pending?: boolean;
	/**
	 * When the user's timeout will expire and the user will be able to communicate in the guild
	 * again, `null` or a time in the past if the user is not timed out
	 */
	communication_disabled_until?: string | null;
	unusual_dm_activity_until?: string | null;
};

export type GuildMemberWithOptionalVoiceFields = Omit<GuildMember, "deaf" | "mute"> & Partial<GuildMember>;

export type PartialUserWithMemberField = PartialUser & { member: GuildMember };

//#endregion


//#region REST API

export type ListThreadsResponse = {
	threads: Thread[];
	members: ThreadMember[];
	has_more: boolean;
};

//#endregion


//#region Gateway

export const enum GatewayOpcode {
	/** An event was dispatched */
	Dispatch = 0,
	/** Keep the WebSocket connection alive */
	Heartbeat = 1,
	/** Start a new session during the initial handshake */
	Identify = 2,
	/** Update the client's presence */
	PresenceUpdate = 3,
	/** Join/leave or move between voice channels and calls */
	VoiceStateUpdate = 4,
	/** Ping the Discord voice servers */
	VoiceServerPing = 5,
	/** Resume a previous session that was disconnected */
	Resume = 6,
	/** You should attempt to reconnect and resume immediately */
	Reconnect = 7,
	/** Request information about guild members */
	RequestGuildMembers = 8,
	/** The session has been invalidated. You should reconnect and identify/resume accordingly */
	InvalidSession = 9,
	/** Sent immediately after connecting, contains the heartbeat_interval to use */
	Hello = 10,
	/** Response to receiving a heartbeat to acknowledge that it has been received */
	HeartbeatACK = 11,
	/** Request all members and presences for guilds */
	GuildSync = 12,
	/** Request a private channels's pre-existing call data */
	CallConnect = 13,
	/** Update subscriptions for a guild */
	GuildSubscriptions = 14,
	/** Join a lobby */
	LobbyConnect = 15,
	/** Leave a lobby */
	LobbyDisconnect = 16,
	/** Update the client's voice state in a lobby */
	LobbyVoiceStates = 17,
	/** Create a stream for the client */
	StreamCreate = 18,
	/** End a client stream */
	StreamDelete = 19,
	/** Watch a user's stream */
	StreamWatch = 20,
	/** Ping a user stream's voice server */
	StreamPing = 21,
	/** Pause/resume a client stream */
	StreamSetPaused = 22,
	/** Update subscriptions for an LFG lobby */
	LFGSubscriptions = 23,
	/** Request guild application commands */
	RequestGuildApplicationCommands = 24,
	/** Launch an embedded activity in a voice channel or call */
	EmbeddedActivityCreate = 25,
	/** Stop an embedded activity */
	EmbeddedActivityDelete = 26,
	/** Update an embedded activity */
	EmbeddedActivityUpdate = 27,
	/** Request forum channel unread counts */
	RequestForumUnreads = 28,
	/** Send a remote command to an embedded (Xbox, PlayStation) voice session */
	RemoteCommand = 29,
	/** Request deleted entity IDs not matching a given hash for a guild */
	RequestDeletedEntityIDs = 30,
	/** Request soundboard sounds for guilds */
	RequestSoundboardSounds = 31,
	/** Create a voice speed test */
	SpeedTestCreate = 32,
	/** Delete a voice speed test */
	SpeedTestDelete = 33,
	/** Request last messages for a guild's channels */
	RequestLastMessages = 34,
	/** Request information about recently-joined guild members */
	SearchRecentMembers = 35,
	/** Request voice channel statuses for a guild */
	RequestChannelStatuses = 36,
}

export type DispatchEventName =
	"READY" |
	"READY_SUPPLEMENTAL" |
	"RESUMED" |
	"AUTH_SESSION_CHANGE" |
	"AUTHENTICATOR_CREATE" |
	"AUTHENTICATOR_UPDATE" |
	"AUTHENTICATOR_DELETE" |
	"APPLICATION_COMMAND_PERMISSIONS_UPDATE" |
	"AUTO_MODERATION_RULE_CREATE" |
	"AUTO_MODERATION_RULE_UPDATE" |
	"AUTO_MODERATION_RULE_DELETE" |
	"AUTO_MODERATION_ACTION_EXECUTION" |
	"AUTO_MODERATION_MENTION_RAID_DETECTION" |
	"CALL_CREATE" |
	"CALL_UPDATE" |
	"CALL_DELETE" |
	"CHANNEL_CREATE" |
	"CHANNEL_UPDATE" |
	"CHANNEL_DELETE" |
	"CHANNEL_STATUSES" |
	"VOICE_CHANNEL_STATUS_UPDATE" |
	"CHANNEL_PINS_UPDATE" |
	"CHANNEL_RECIPIENT_ADD" |
	"CHANNEL_RECIPIENT_REMOVE" |
	"DM_SETTINGS_UPSELL_SHOW" |
	"THREAD_CREATE" |
	"THREAD_UPDATE" |
	"THREAD_DELETE" |
	"THREAD_LIST_SYNC" |
	"THREAD_MEMBER_UPDATE" |
	"THREAD_MEMBERS_UPDATE" |
	"FRIEND_SUGGESTION_CREATE" |
	"FRIEND_SUGGESTION_DELETE" |
	"GUILD_CREATE" |
	"GUILD_UPDATE" |
	"GUILD_DELETE" |
	"GUILD_AUDIT_LOG_ENTRY_CREATE" |
	"GUILD_BAN_ADD" |
	"GUILD_BAN_REMOVE" |
	"GUILD_EMOJIS_UPDATE" |
	"GUILD_STICKERS_UPDATE" |
	"GUILD_JOIN_REQUEST_CREATE" |
	"GUILD_JOIN_REQUEST_UPDATE" |
	"GUILD_JOIN_REQUEST_DELETE" |
	"GUILD_MEMBER_ADD" |
	"GUILD_MEMBER_REMOVE" |
	"GUILD_MEMBER_UPDATE" |
	"GUILD_MEMBERS_CHUNK" |
	"GUILD_ROLE_CREATE" |
	"GUILD_ROLE_UPDATE" |
	"GUILD_ROLE_DELETE" |
	"GUILD_SCHEDULED_EVENT_CREATE" |
	"GUILD_SCHEDULED_EVENT_UPDATE" |
	"GUILD_SCHEDULED_EVENT_DELETE" |
	"GUILD_SCHEDULED_EVENT_USER_ADD" |
	"GUILD_SCHEDULED_EVENT_USER_REMOVE" |
	"GUILD_SOUNDBOARD_SOUND_CREATE" |
	"GUILD_SOUNDBOARD_SOUND_UPDATE" |
	"GUILD_SOUNDBOARD_SOUND_DELETE" |
	"SOUNDBOARD_SOUNDS" |
	"GUILD_INTEGRATIONS_UPDATE" |
	"INTEGRATION_CREATE" |
	"INTEGRATION_UPDATE" |
	"INTEGRATION_DELETE" |
	"INTERACTION_CREATE" |
	"INVITE_CREATE" |
	"INVITE_DELETE" |
	"MESSAGE_CREATE" |
	"MESSAGE_UPDATE" |
	"MESSAGE_DELETE" |
	"MESSAGE_DELETE_BULK" |
	"MESSAGE_POLL_VOTE_ADD" |
	"MESSAGE_POLL_VOTE_REMOVE" |
	"MESSAGE_REACTION_ADD" |
	"MESSAGE_REACTION_ADD_MANY" |
	"MESSAGE_REACTION_REMOVE" |
	"MESSAGE_REACTION_REMOVE_ALL" |
	"MESSAGE_REACTION_REMOVE_EMOJI" |
	"RECENT_MENTION_DELETE" |
	"LAST_MESSAGES" |
	"OAUTH2_TOKEN_REVOKE" |
	"PRESENCE_UPDATE" |
	"RELATIONSHIP_ADD" |
	"RELATIONSHIP_UPDATE" |
	"RELATIONSHIP_REMOVE" |
	"STAGE_INSTANCE_CREATE" |
	"STAGE_INSTANCE_UPDATE" |
	"STAGE_INSTANCE_DELETE" |
	"TYPING_START" |
	"USER_UPDATE" |
	"USER_APPLICATION_REMOVE" |
	"USER_CONNECTIONS_UPDATE" |
	"USER_NOTE_UPDATE" |
	"USER_REQUIRED_ACTION_UPDATE" |
	"VOICE_STATE_UPDATE" |
	"VOICE_SERVER_UPDATE" |
	"VOICE_CHANNEL_EFFECT_SEND" |
	"WEBHOOKS_UPDATE";

export const enum GatewayIntent {
	Guilds = 1 << 0,
	GuildMembers = 1 << 1,
	GuildModeration = 1 << 2,
	GuildEmojisAndStickers = 1 << 3,
	GuildIntegrations = 1 << 4,
	GuildWebhooks = 1 << 5,
	GuildInvites = 1 << 6,
	GuildVoiceStates = 1 << 7,
	GuildPresences = 1 << 8,
	GuildMessages = 1 << 9,
	GuildMessageReactions = 1 << 10,
	GuildMessageTyping = 1 << 11,
	DirectMessages = 1 << 12,
	DirectMessageReactions = 1 << 13,
	DirectMessageTyping = 1 << 14,
	MessageContent = 1 << 15,
	GuildScheduledEvents = 1 << 16,
	AutoModerationConfiguration = 1 << 20,
	AutoModerationExecution = 1 << 21,
	GuildMessagePolls = 1 << 24,
	DirectMessagePolls = 1 << 25,
}

type GatewayGenericPayload<O extends GatewayOpcode, D> = {
	/** Gateway opcode, which indicates the payload type */
	op: O;
	/** Event data */
	d: D;
};

type GatewayGenericNonDispatchPayload<O extends GatewayOpcode, D> = GatewayGenericPayload<O, D>;
type GatewayGenericDispatchPayload<N extends DispatchEventName, D> = GatewayGenericPayload<GatewayOpcode.Dispatch, D> & {
	/** Sequence number of event used for resuming sessions and heartbeating */
	s: number;
	/** Dispatch event name */
	t: N;
};

//#region Sendable payloads

export type GatewayIdentifyPayloadBot = GatewayGenericNonDispatchPayload<GatewayOpcode.Identify, {
	token: string;
	/** Connection properties */
	properties: {
		os: string;
		browser: string;
		device: string;
	};
	/** Whether to enable payload compression (not transport compression) */
	compress?: boolean;
	/**
	 * Value between 50 and 250, total number of members where the gateway will stop sending offline
	 * members in the guild member list
	 */
	large_threshold?: number;
	shard?: [shard_id: number, num_shards: number];
	/** Presence structure for initial presence information */
	presence?: {
		/** Unix time (in milliseconds) of when the client went idle, or null if the client is not idle */
		since: number | null;
		/** User's activities */
		activities: unknown[];
		/** User's new status */
		status: "online" | "dnd" | "idle" | "invisible" | "offline";
		/** Whether or not the client is afk */
		afk: boolean;
	};
	/** Gateway intents */
	intents: number;
}>;
export type GatewayResumePayload = GatewayGenericNonDispatchPayload<GatewayOpcode.Resume, {
	token: string;
	session_id: string;
	/** Last sequence number received */
	seq: number;
}>;
export type GatewayHeartbeatPayload = GatewayGenericNonDispatchPayload<GatewayOpcode.Heartbeat, number>;
export type GatewayRequestGuildMembersPayload = GatewayGenericNonDispatchPayload<GatewayOpcode.RequestGuildMembers, {
	/** ID of the guild to get members for */
	guild_id: string;
	/** String that username starts with, or an empty string to return all members */
	query?: string;
	/**
	 * Maximum number of members to send matching the query
	 *
	 * A limit of 0 can be used with an empty string query to return all members
	 */
	limit: number;
	/** Used to specify if we want the presences of the matched members */
	presences?: boolean;
	/** Used to specify which users you wish to fetch */
	user_ids?: string[];
	/** Nonce to identify the Guild Members Chunk response */
	nonce?: string;
}>;


export type GatewaySendPayload =
	GatewayIdentifyPayloadBot |
	GatewayResumePayload |
	GatewayHeartbeatPayload |
	GatewayRequestGuildMembersPayload;

//#endregion

//#region Receivable payloads

export type GatewayHeartbeatRequestPayload = GatewayGenericNonDispatchPayload<GatewayOpcode.Heartbeat, null>;
export type GatewayReconnectPayload = GatewayGenericNonDispatchPayload<GatewayOpcode.Reconnect, boolean>;
export type GatewayInvalidSessionPayload = GatewayGenericNonDispatchPayload<GatewayOpcode.InvalidSession, boolean>;
export type GatewayHelloPayload = GatewayGenericNonDispatchPayload<GatewayOpcode.Hello, {
	heartbeat_interval: number;
}>;
export type GatewayHeartbeatACKPayload = GatewayGenericNonDispatchPayload<GatewayOpcode.HeartbeatACK, null>;

export type GatewayReadyDispatchPayloadBot = GatewayGenericDispatchPayload<"READY", {
	/** API version */
	v: number;
	user: User;
	guilds: UnavailableGuild[];
	session_id: string;
	resume_gateway_url: string;
	shard?: [shard_id: number, num_shards: number];
	application: {
		id: string;
		flags: number;
	};
}>;
export type GatewayChannelDispatchChannel = (GuildChannel & GuildIDChannelFields) | DirectChannel;
export type GatewayChannelCreateDispatchPayload = GatewayGenericDispatchPayload<"CHANNEL_CREATE", GatewayChannelDispatchChannel>;
export type GatewayChannelUpdateDispatchPayload = GatewayGenericDispatchPayload<"CHANNEL_UPDATE", GatewayChannelDispatchChannel>;
export type GatewayChannelDeleteDispatchPayload = GatewayGenericDispatchPayload<"CHANNEL_DELETE", GatewayChannelDispatchChannel>;
export type GatewayThreadCreateDispatchPayload = GatewayGenericDispatchPayload<"THREAD_CREATE", Thread & GuildIDChannelFields & {
	/** Whether this thread was newly created (not `true` when being added to a private thread) */
	newly_created?: boolean;
}>;
export type GatewayThreadUpdateDispatchPayload = GatewayGenericDispatchPayload<"THREAD_UPDATE", Thread & GuildIDChannelFields>;
export type GatewayThreadDeleteDispatchPayload = GatewayGenericDispatchPayload<"THREAD_DELETE", Pick<Thread & GuildIDChannelFields, "id" | "guild_id" | "parent_id" | "type">>;
export type GatewayThreadListSyncDispatchPayload = GatewayGenericDispatchPayload<"THREAD_LIST_SYNC", {
	guild_id: string;
	channel_ids: string[];
	threads: Thread[];
	members: ThreadMember[];
}>;
export type GatewayGuildCreateDispatchPayload = GatewayGenericDispatchPayload<"GUILD_CREATE", Guild & {
	joined_at: string;
	large: boolean;
	unavailable?: boolean;
	member_count: number;
	voice_states: unknown;
	members: GuildMember[];
	channels: GuildChannel[];
	threads: Thread[];
	presences: unknown[];
	stage_instances: unknown[];
	guild_scheduled_events: unknown[];
	soundboard_sounds: unknown[];

	// Undocumented fields
	moderator_reporting: unknown;
	activity_instances: unknown;
	hub_type: unknown;
	latest_onboarding_question_id: unknown;
	premium_features: unknown;
	owner_configured_content_level: unknown;
	embedded_activities: unknown;
	lazy: unknown;
	application_command_counts: unknown;
	home_header: unknown;
	version: unknown;
	inventory_settings: unknown;
}>;
export type GatewayGuildUpdateDispatchPayload = GatewayGenericDispatchPayload<"GUILD_UPDATE", Guild & {
	// Undocumented
	guild_id?: unknown;
}>;
export type GatewayGuildDeleteDispatchPayload = GatewayGenericDispatchPayload<"GUILD_DELETE", UnavailableGuild>;
export type GatewayGuildEmojisUpdateDispatchPayload = GatewayGenericDispatchPayload<"GUILD_EMOJIS_UPDATE", {
	guild_id: string;
	emojis: CustomEmoji[];
}>;
export type GatewayGuildMemberAddDispatchPayload = GatewayGenericDispatchPayload<"GUILD_MEMBER_ADD", GuildMember & {
	guild_id: string;
}>;
export type GatewayGuildMemberRemoveDispatchPayload = GatewayGenericDispatchPayload<"GUILD_MEMBER_REMOVE", {
	guild_id: string;
	user: PartialUser;
}>;
export type GatewayGuildMemberUpdateDispatchPayload = GatewayGenericDispatchPayload<"GUILD_MEMBER_UPDATE", GuildMemberWithOptionalVoiceFields & {
	guild_id: string;
}>;
export type GatewayGuildMembersChunkPayload = GatewayGenericDispatchPayload<"GUILD_MEMBERS_CHUNK", {
	guild_id: string;
	members: GuildMember[];
	chunk_index: number;
	chunk_count: number;
	not_found?: string[];
	presences: unknown[];
	nonce?: string;
}>;
export type GatewayGuildRoleCreateDispatchPayload = GatewayGenericDispatchPayload<"GUILD_ROLE_CREATE", {
	guild_id: string;
	role: Role;
}>;
export type GatewayGuildRoleUpdateDispatchPayload = GatewayGenericDispatchPayload<"GUILD_ROLE_UPDATE", {
	guild_id: string;
	role: Role;
}>;
export type GatewayGuildRoleDeleteDispatchPayload = GatewayGenericDispatchPayload<"GUILD_ROLE_DELETE", {
	guild_id: string;
	role_id: string;
}>;
export type GatewayMessageCreateDispatchPayload = GatewayGenericDispatchPayload<"MESSAGE_CREATE", Message & {
	channel_type: number;
	guild_id?: string;
	member?: GuildMember;
	// The docs say that the user objects have a partial member field
	mentions: PartialUserWithMemberField[];
	/** Custom metadata for the message (max 25 keys, 1024 characters per key and value) */
	metadata?: object;
	nonce?: string;
}>;
export type GatewayMessageUpdateDispatchPayload = GatewayGenericDispatchPayload<"MESSAGE_UPDATE", GatewayMessageCreateDispatchPayload["d"]>;
export type GatewayMessageDeleteDispatchPayload = GatewayGenericDispatchPayload<"MESSAGE_DELETE", {
	/** Message ID */
	id: string;
	channel_id: string;
	guild_id?: string;
}>;
export type GatewayMessageReactionAddDispatchPayload = GatewayGenericDispatchPayload<"MESSAGE_REACTION_ADD", {
	user_id: string;
	channel_id: string;
	message_id: string;
	guild_id?: string;
	member?: GuildMember;
	emoji: PartialEmoji;
	message_author_id?: string;
	burst: boolean;
	burst_colors?: string[];
	type: ReactionType;
}>;
export type GatewayMessageReactionRemoveDispatchPayload = GatewayGenericDispatchPayload<"MESSAGE_REACTION_REMOVE", {
	user_id: string;
	channel_id: string;
	message_id: string;
	guild_id?: string;
	emoji: PartialEmoji;
	message_author_id?: string;
	burst: boolean;
	type: ReactionType;
}>;
export type GatewayMessageReactionRemoveAllDispatchPayload = GatewayGenericDispatchPayload<"MESSAGE_REACTION_REMOVE_ALL", {
	channel_id: string;
	message_id: string;
	guild_id?: string;
}>;
export type GatewayMessageReactionRemoveEmojiDispatchPayload = GatewayGenericDispatchPayload<"MESSAGE_REACTION_REMOVE_EMOJI", {
	channel_id: string;
	message_id: string;
	guild_id?: string;
	emoji: PartialEmoji;
}>;
export type GatewayVoiceStateUpdateDispatchPayload = GatewayGenericDispatchPayload<"VOICE_STATE_UPDATE", {
	guild_id?: string | null;
	channel_id: string | null;
	user_id: string;
	member?: GuildMember;
	session_id: string;
	deaf: boolean;
	mute: boolean;
	self_deaf: boolean;
	self_mute: boolean;
	self_stream?: boolean;
	self_video: boolean;
	suppress: boolean;
	request_to_speak_timestamp: boolean;
	discoverable?: boolean;
}>;

export type GatewayDispatchPayload =
	GatewayReadyDispatchPayloadBot |
	GatewayChannelCreateDispatchPayload |
	GatewayChannelUpdateDispatchPayload |
	GatewayChannelDeleteDispatchPayload |
	GatewayThreadCreateDispatchPayload |
	GatewayThreadUpdateDispatchPayload |
	GatewayThreadDeleteDispatchPayload |
	GatewayThreadListSyncDispatchPayload |
	GatewayGuildCreateDispatchPayload |
	GatewayGuildUpdateDispatchPayload |
	GatewayGuildDeleteDispatchPayload |
	GatewayGuildEmojisUpdateDispatchPayload |
	GatewayGuildMemberAddDispatchPayload |
	GatewayGuildMemberRemoveDispatchPayload |
	GatewayGuildMemberUpdateDispatchPayload |
	GatewayGuildMembersChunkPayload |
	GatewayGuildRoleCreateDispatchPayload |
	GatewayGuildRoleUpdateDispatchPayload |
	GatewayGuildRoleDeleteDispatchPayload |
	GatewayMessageCreateDispatchPayload |
	GatewayMessageUpdateDispatchPayload |
	GatewayMessageDeleteDispatchPayload |
	GatewayMessageReactionAddDispatchPayload |
	GatewayMessageReactionRemoveDispatchPayload |
	GatewayMessageReactionRemoveAllDispatchPayload |
	GatewayMessageReactionRemoveEmojiDispatchPayload |
	GatewayVoiceStateUpdateDispatchPayload |
	GatewayGenericDispatchPayload<DispatchEventName, never>;

export type GatewayReceivePayload =
	GatewayDispatchPayload |
	GatewayHeartbeatRequestPayload |
	GatewayReconnectPayload |
	GatewayInvalidSessionPayload |
	GatewayHelloPayload |
	GatewayHeartbeatACKPayload;

//#endregion

//#endregion
