-- In the snapshot tables, making the primary key be (id, _timestamp), in that order, allows SQLite to find
-- all snapshots for a given object and a specific snapshot for a given object faster.

-- Common columns:
--   * _timestamp: Contains the UNIX timestamp of when the snapshot was taken in bits 1-63 and the
--     least significant bit indicates if the snapshot was taken in reaction to a gateway event
--     (1 if it was, 0 if not). The special value 0 indicates that the snapshot depicts the state
--     of the object when it was created (e.g. snapshot taken in reaction to a create event).
--   * _deleted: Contains the UNIX timestamp of when the first snapshot where the object was found
--     to be deleted was taken in bits 1-63 and the least significant bit indicates if the
--     deletion was caught in a gateway event. NULL if it wasn't deleted.
--   * _extra: Contains fields that have no corresponding column in the table, in JSON. This is
--     used when encountering unknown fields. Some known fields are always stored in this column.

BEGIN;

-- TODO: Change when the format is stable
PRAGMA application_id = -1;
PRAGMA user_version = -1;


CREATE TABLE latest_user_snapshots (
	id INTEGER NOT NULL PRIMARY KEY,
	_deleted INTEGER,
	bot INTEGER NOT NULL,
	system INTEGER NOT NULL,
	---
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	username TEXT NOT NULL, -- the user's username, not unique across the platform
	discriminator TEXT, -- the user's 4-digit discord-tag, NULL if the user has none (represented as "0" in the API)
	global_name TEXT, -- the user's display name, if it is set. For bots, this is the application name
	avatar BLOB, -- the user's avatar hash
	avatar_decoration_data__asset BLOB, -- the avatar decoration hash
	avatar_decoration_data__sku_id INTEGER, -- ID of the avatar decoration's SKU
	avatar_decoration_data__expires_at INTEGER, -- Unix timestamp of when the current avatar decoration expires
	collectibles__nameplate__asset STRING, -- the nameplate asset path
	collectibles__nameplate__sku_id INTEGER, -- the ID of the nameplate's SKU
	collectibles__nameplate__label STRING, -- the nameplate's accessibility description
	collectibles__nameplate__palette STRING, -- the nameplate's color palette
	collectibles__nameplate__expires_at INTEGER, -- Unix timestamp of when the current nameplate expires
	display_name_styles__font_id INTEGER, -- the font to use for the user's display name
	display_name_styles__effect_id INTEGER, -- the effect to use for the user's display name
	display_name_styles__colors TEXT, -- the colors to use for the user's display name
	primary_guild__identity_guild_id INTEGER, -- ID of the user's primary guild
	primary_guild__identity_enabled INTEGER, -- hether the user is displaying the primary guild's server tag
	primary_guild__tag TEXT, -- the text of the user's server tag
	primary_guild__badge BLOB, -- the server tag badge hash
	public_flags INTEGER -- the public flags on a user's account
);
CREATE TABLE previous_user_snapshots (
	id INTEGER NOT NULL REFERENCES latest_user_snapshots (id),
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	username TEXT NOT NULL, -- the user's username, not unique across the platform
	discriminator TEXT, -- the user's 4-digit discord-tag, NULL if the user has none (represented as "0" in the API)
	global_name TEXT, -- the user's display name, if it is set. For bots, this is the application name
	avatar BLOB, -- the user's avatar hash
	avatar_decoration_data__asset BLOB, -- the avatar decoration hash
	avatar_decoration_data__sku_id INTEGER, -- ID of the avatar decoration's SKU
	avatar_decoration_data__expires_at INTEGER, -- Unix timestamp of when the current avatar decoration expires
	collectibles__nameplate__asset STRING, -- the nameplate asset path
	collectibles__nameplate__sku_id INTEGER, -- the ID of the nameplate's SKU
	collectibles__nameplate__label STRING, -- the nameplate's accessibility description
	collectibles__nameplate__palette STRING, -- the nameplate's color palette
	collectibles__nameplate__expires_at INTEGER, -- Unix timestamp of when the current nameplate expires
	display_name_styles__font_id INTEGER, -- the font to use for the user's display name
	display_name_styles__effect_id INTEGER, -- the effect to use for the user's display name
	display_name_styles__colors TEXT, -- the colors to use for the user's display name
	primary_guild__identity_guild_id INTEGER, -- ID of the user's primary guild
	primary_guild__identity_enabled INTEGER, -- hether the user is displaying the primary guild's server tag
	primary_guild__tag TEXT, -- the text of the user's server tag
	primary_guild__badge BLOB, -- the server tag badge hash
	public_flags INTEGER, -- the public flags on a user's account
	PRIMARY KEY (id, _timestamp)
) WITHOUT ROWID;


-- Guilds aren't deletable because it seems to be impossible to distinguish account leave from deletion.
CREATE TABLE latest_guild_snapshots (
	id INTEGER NOT NULL PRIMARY KEY,
	_deleted INTEGER,
	---
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	name TEXT NOT NULL, -- guild name (2-100 characters, excluding trailing and leading whitespace)
	icon BLOB, -- icon hash
	splash BLOB, -- splash hash
	discovery_splash BLOB, -- discovery splash hash; only present for guilds with the "DISCOVERABLE" feature
	owner_id INTEGER, -- ID of owner
	afk_channel_id INTEGER, -- ID of afk channel
	afk_timeout INTEGER NOT NULL, -- afk timeout in seconds
	widget_enabled INTEGER NOT NULL, -- 1 if the server widget is enabled
	widget_channel_id INTEGER, -- the channel ID that the widget will generate an invite to, or NULL if set to no invite
	verification_level INTEGER NOT NULL, -- verification level required for the guild
	default_message_notifications INTEGER NOT NULL, -- default message notifications level
	explicit_content_filter INTEGER NOT NULL, -- explicit content filter level
	mfa_level INTEGER NOT NULL, -- required MFA level for the guild
	system_channel_id INTEGER, -- the ID of the channel where guild notices such as welcome messages and boost events are posted      
	system_channel_flags INTEGER NOT NULL, -- system channel flags
	rules_channel_id INTEGER, -- the ID of the channel where Community guilds can display rules and/or guidelines
	max_presences INTEGER, -- the maximum number of members for the guild
	max_members INTEGER, -- the maximum number of members for the guild
	vanity_url_code TEXT, -- the vanity url code for the guild
	description TEXT, -- the description of a Community guild
	banner TEXT, -- banner hash
	premium_tier INTEGER NOT NULL, -- premium tier (Server Boost level)
	premium_subscription_count INTEGER, -- the number of boosts this guild currently has
	preferred_locale TEXT NOT NULL, -- the preferred locale of a Community guild; used in server discovery and notices from Discord, and sent in interactions; defaults to "en-US"
	public_updates_channel_id INTEGER, -- the ID of the channel where admins and moderators of Community guilds receive notices from Discord
	max_video_channel_users INTEGER, -- the maximum amount of users in a video channel
	max_stage_video_channel_users INTEGER, -- the maximum amount of users in a stage video channel
	nsfw_level INTEGER NOT NULL, -- guild NSFW level
	premium_progress_bar_enabled INTEGER NOT NULL, -- whether the guild has the boost progress bar enabled
	safety_alerts_channel_id INTEGER, -- the ID of the channel where admins and moderators of Community guilds receive safety alerts from Discord
	profile__tag TEXT, -- the tag of the guild (2-4 characters)
	profile__badge TEXT -- the guild badge hash
);
CREATE TABLE previous_guild_snapshots (
	_timestamp INTEGER NOT NULL, -- when this snapshot was taken
	_extra TEXT,
	id INTEGER NOT NULL REFERENCES latest_guild_snapshots (id),
	name TEXT, -- guild name (2-100 characters, excluding trailing and leading whitespace)
	icon BLOB, -- icon hash
	splash BLOB, -- splash hash
	discovery_splash BLOB, -- discovery splash hash; only present for guilds with the "DISCOVERABLE" feature
	owner_id INTEGER, -- ID of owner
	afk_channel_id INTEGER, -- ID of afk channel
	afk_timeout INTEGER NOT NULL, -- afk timeout in seconds
	widget_enabled INTEGER NOT NULL, -- 1 if the server widget is enabled
	widget_channel_id INTEGER, -- the channel ID that the widget will generate an invite to, or NULL if set to no invite
	verification_level INTEGER NOT NULL, -- verification level required for the guild
	default_message_notifications INTEGER NOT NULL, -- default message notifications level
	explicit_content_filter INTEGER NOT NULL, -- explicit content filter level
	mfa_level INTEGER NOT NULL, -- required MFA level for the guild
	system_channel_id INTEGER, -- the ID of the channel where guild notices such as welcome messages and boost events are posted      
	system_channel_flags INTEGER NOT NULL, -- system channel flags
	rules_channel_id INTEGER, -- the ID of the channel where Community guilds can display rules and/or guidelines
	max_presences INTEGER, -- the maximum number of members for the guild
	max_members INTEGER, -- the maximum number of members for the guild
	vanity_url_code TEXT, -- the vanity url code for the guild
	description TEXT, -- the description of a Community guild
	banner TEXT, -- banner hash
	premium_tier INTEGER NOT NULL, -- premium tier (Server Boost level)
	premium_subscription_count INTEGER, -- the number of boosts this guild currently has
	preferred_locale TEXT NOT NULL, -- the preferred locale of a Community guild; used in server discovery and notices from Discord, and sent in interactions; defaults to "en-US"
	public_updates_channel_id INTEGER, -- the ID of the channel where admins and moderators of Community guilds receive notices from Discord
	max_video_channel_users INTEGER, -- the maximum amount of users in a video channel
	max_stage_video_channel_users INTEGER, -- the maximum amount of users in a stage video channel
	nsfw_level INTEGER NOT NULL, -- guild NSFW level
	premium_progress_bar_enabled INTEGER NOT NULL, -- whether the guild has the boost progress bar enabled
	safety_alerts_channel_id INTEGER, -- the ID of the channel where admins and moderators of Community guilds receive safety alerts from Discord
	profile__tag TEXT, -- the tag of the guild (2-4 characters)
	profile__badge TEXT, -- the guild badge hash
	PRIMARY KEY (id, _timestamp)
) WITHOUT ROWID;


CREATE TABLE latest_role_snapshots (
	id INTEGER NOT NULL PRIMARY KEY,
	_deleted INTEGER,
	_guild_id INTEGER NOT NULL REFERENCES latest_guild_snapshots (id), -- the ID of the guild
	managed INTEGER NOT NULL, -- whether this role is managed by an integration
	tags__bot_id INTEGER, -- the ID of the bot this role belongs to
	tags__premium_subscriber INTEGER, -- whether this is the guild's Booster role
	---
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	name TEXT NOT NULL, -- role name
	colors__primary_color INTEGER NOT NULL, -- the primary color for the role
	colors__secondary_color INTEGER, -- the secondary color for the role, this will make the role a gradient between the other provided colors
	colors__tertiary_color INTEGER, -- the tertiary color for the role, this will turn the gradient into a holographic style
	hoist INTEGER NOT NULL, -- if this role is pinned in the user listing
	icon BLOB, -- role icon hash
	unicode_emoji TEXT, -- role unicode emoji
	position INTEGER NOT NULL, -- position of this role
	permissions INTEGER NOT NULL, -- permission bit set
	mentionable INTEGER NOT NULL, -- whether this role is mentionable
	flags INTEGER NOT NULL, -- role flags combined as a bitfield
	tags__integration_id INTEGER, -- the ID of the integration this role belongs to
	tags__subscription_listing_id INTEGER, -- the ID of this role's subscription sku and listing
	tags__available_for_purchase INTEGER, -- whether this role is available for purchase
	tags__guild_connections INTEGER -- whether this role is a guild's linked role
);
CREATE INDEX role_by_guild_id ON latest_role_snapshots (_guild_id);
CREATE TABLE previous_role_snapshots (
	id INTEGER NOT NULL REFERENCES latest_role_snapshots (id),
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	name TEXT NOT NULL, -- role name
	colors__primary_color INTEGER NOT NULL, -- the primary color for the role
	colors__secondary_color INTEGER, -- the secondary color for the role, this will make the role a gradient between the other provided colors
	colors__tertiary_color INTEGER, -- the tertiary color for the role, this will turn the gradient into a holographic style
	hoist INTEGER NOT NULL, -- if this role is pinned in the user listing
	icon TEXT, -- role icon hash
	unicode_emoji TEXT, -- role unicode emoji
	position INTEGER NOT NULL, -- position of this role
	permissions INTEGER NOT NULL, -- permission bit set
	mentionable INTEGER NOT NULL, -- whether this role is mentionable
	flags INTEGER NOT NULL, -- role flags combined as a bitfield
	tags__integration_id INTEGER, -- the ID of the integration this role belongs to
	tags__subscription_listing_id INTEGER, -- the ID of this role's subscription sku and listing
	tags__available_for_purchase INTEGER, -- whether this role is available for purchase
	tags__guild_connections INTEGER, -- whether this role is a guild's linked role
	PRIMARY KEY (id, _timestamp)
) WITHOUT ROWID;


-- Since members can leave and join again, there's no _deleted column. Instead, when a user leaves
-- a guild, a special snapshot is saved with joined_at set to NULL and all other columns set to
-- irrelevant values.
CREATE TABLE member_snapshots (
	_guild_id INTEGER NOT NULL REFERENCES latest_guild_snapshots (id),
	_user_id INTEGER NOT NULL REFERENCES latest_user_snapshots (id),
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	nick TEXT, -- this user's guild nickname
	avatar BLOB, -- the member's guild avatar hash
	avatar_decoration_data__asset BLOB, -- the avatar decoration hash
	avatar_decoration_data__sku_id INTEGER, -- ID of the avatar decoration's SKU
	avatar_decoration_data__expires_at INTEGER, -- Unix timestamp of when the current avatar decoration expires
	collectibles__nameplate__asset STRING, -- the nameplate asset path
	collectibles__nameplate__sku_id INTEGER, -- the ID of the nameplate's SKU
	collectibles__nameplate__label STRING, -- the nameplate's accessibility description
	collectibles__nameplate__palette STRING, -- the nameplate's color palette
	collectibles__nameplate__expires_at INTEGER, -- Unix timestamp of when the current nameplate expires
	display_name_styles__font_id INTEGER, -- the font to use for the member's display name
	display_name_styles__effect_id INTEGER, -- the effect to use for the member's display name
	display_name_styles__colors TEXT, -- the colors to use for the member's display name
	banner BLOB, -- the member's guild banner hash
	roles BLOB, -- array of role IDs
	joined_at INTEGER, -- when the user joined the guild, or NULL if this snapshot indicates that the user left the guild
	premium_since INTEGER, -- when the user started boosting the guild
	deaf INTEGER, -- whether the user is deafened in voice channels or `NULL` if unknown
	mute INTEGER, -- whether the user is muted in voice channels or `NULL` if unknown
	flags INTEGER NOT NULL, -- guild member flags represented as a bit field
	pending INTEGER NOT NULL, -- whether the user has not yet passed the guild's Membership Screening requirements
	communication_disabled_until INTEGER, -- when the user's timeout will expire and the user will be able to communicate in the guild again, null or a time in the past if the user is not timed out
	PRIMARY KEY (_guild_id, _user_id, _timestamp)
) WITHOUT ROWID;


CREATE TABLE latest_channel_snapshots (
	id INTEGER NOT NULL PRIMARY KEY,
	_last_synced_message_id INTEGER NOT NULL DEFAULT 0, -- the message ID from which the archiver must resume syncing in order to guarantee that every message in the channel is synced, or 0 if the archiver must start from the beginning of the channel
	_deleted INTEGER,
	type INTEGER NOT NULL, -- the type of channel
	guild_id INTEGER REFERENCES latest_guild_snapshots (id), -- the ID of the guild, or NULL for DM channels
	---
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	position INTEGER, -- sorting position of the channel
	permission_overwrites BLOB, -- explicit permission overwrites for members and roles
	name TEXT, -- the name of the channel (1-100 characters)
	topic TEXT, -- the channel topic (0-1024 characters)
	nsfw INTEGER, -- whether the channel is nsfw
	bitrate INTEGER, -- the bitrate (in bits) of the voice channel
	user_limit INTEGER, -- the user limit of the voice channel
	rate_limit_per_user INTEGER, -- amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages or manage_channel, are unaffected
	icon TEXT, -- icon hash of the group DM
	owner_id INTEGER, -- ID of the creator of the group DM
	-- `application_id` and `managed` are missing because they're not useful
	parent_id INTEGER, -- for guild channels: ID of the parent category for a channel (each parent category can contain up to 50 channels), for threads: ID of the text channel this thread was created
	rtc_region TEXT, -- voice region ID for the voice channel, automatic when set to null
	video_quality_mode INTEGER, -- the camera video quality mode of the voice channel, 1 when not present
	default_auto_archive_duration INTEGER, -- default duration that the clients (not the API) will use for newly created threads, in minutes, to automatically archive the thread after recent activity, can be set to: 60, 1440, 4320, 10080
	flags INTEGER, -- channel flags combined as a bitfield
	default_reaction_emoji BLOB, -- the ID of a guild's custom emoji (if INTEGER) or the unicode character of the emoji (if TEXT) to show in the add reaction button on a thread in a GUILD_FORUM channel
	default_thread_rate_limit_per_user INTEGER, -- the initial rate_limit_per_user to set on newly created threads in a channel. this field is copied to the thread at creation time and does not live update
	default_sort_order INTEGER, -- the default sort order type used to order posts in GUILD_FORUM channels. Defaults to null, which indicates a preferred sort order hasn't been set by a channel admin
	default_forum_layout INTEGER, -- the default forum layout view used to display posts in GUILD_FORUM channels. Defaults to 0, which indicates a layout view has not been set by a channel admin
	default_tag_setting TEXT -- the default tag matching behavior
);
CREATE INDEX channel_by_guild_id ON latest_channel_snapshots (guild_id);
CREATE TABLE previous_channel_snapshots (
	id INTEGER NOT NULL REFERENCES latest_channel_snapshots (id),
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	position INTEGER, -- sorting position of the channel
	permission_overwrites BLOB, -- explicit permission overwrites for members and roles
	name TEXT, -- the name of the channel (1-100 characters)
	topic TEXT, -- the channel topic (0-1024 characters)
	nsfw INTEGER, -- whether the channel is nsfw
	bitrate INTEGER, -- the bitrate (in bits) of the voice channel
	user_limit INTEGER, -- the user limit of the voice channel
	rate_limit_per_user INTEGER, -- amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages or manage_channel, are unaffected
	icon TEXT, -- icon hash of the group DM
	owner_id INTEGER, -- ID of the creator of the group DM
	-- `application_id` and `managed` are missing because they're not useful
	parent_id INTEGER, -- for guild channels: ID of the parent category for a channel (each parent category can contain up to 50 channels), for threads: ID of the text channel this thread was created
	rtc_region TEXT, -- voice region ID for the voice channel, automatic when set to null
	video_quality_mode INTEGER, -- the camera video quality mode of the voice channel, 1 when not present
	default_auto_archive_duration INTEGER, -- default duration that the clients (not the API) will use for newly created threads, in minutes, to automatically archive the thread after recent activity, can be set to: 60, 1440, 4320, 10080
	flags INTEGER, -- channel flags combined as a bitfield
	default_reaction_emoji BLOB, -- the ID of a guild's custom emoji (if INTEGER) or the unicode character of the emoji (if TEXT) to show in the add reaction button on a thread in a GUILD_FORUM channel
	default_thread_rate_limit_per_user INTEGER, -- the initial rate_limit_per_user to set on newly created threads in a channel. this field is copied to the thread at creation time and does not live update
	default_sort_order INTEGER, -- the default sort order type used to order posts in GUILD_FORUM channels. Defaults to null, which indicates a preferred sort order hasn't been set by a channel admin
	default_forum_layout INTEGER, -- the default forum layout view used to display posts in GUILD_FORUM channels. Defaults to 0, which indicates a layout view has not been set by a channel admin
	default_tag_setting TEXT, -- the default tag matching behavior
	PRIMARY KEY (id, _timestamp)
) WITHOUT ROWID;

CREATE TABLE latest_thread_snapshots (
	id INTEGER NOT NULL PRIMARY KEY,
	_last_synced_message_id INTEGER NOT NULL DEFAULT 0, -- the message ID from which the archiver must resume syncing in order to guarantee that every message in the thread is synced, or 0 if the archiver must start from the beginning of the thread
	_deleted INTEGER,
	type INTEGER NOT NULL, -- the type of channel
	parent_id INTEGER NOT NULL REFERENCES latest_channel_snapshots (id), -- ID of the channel this thread was created from
	---
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	name TEXT, -- the name of the channel (1-100 characters)
	rate_limit_per_user INTEGER, -- amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages or manage_channel, are unaffected
	owner_id INTEGER, -- ID of the creator of the thread
	thread_metadata__archived INTEGER, -- whether the thread is archived
	thread_metadata__auto_archive_duration INTEGER, -- the thread will stop showing in the channel list after auto_archive_duration minutes of inactivity, can be set to: 60, 1440, 4320, 10080
	thread_metadata__archive_timestamp INTEGER, -- timestamp when the thread's archive status was last changed, used for calculating recent activity
	thread_metadata__locked INTEGER, -- whether the thread is locked; when a thread is locked, only users with MANAGE_THREADS can unarchive it
	thread_metadata__invitable INTEGER, -- whether non-moderators can add other non-moderators to a thread; only available on private threads
	thread_metadata__create_timestamp INTEGER, -- timestamp when the thread was created; only populated for threads created after 2022-01-09
	flags INTEGER, -- channel flags combined as a bitfield
	applied_tags BLOB -- IDs of the set of tags that have been applied to a thread in a GUILD_FORUM or a GUILD_MEDIA channel
);
CREATE INDEX thread_by_parent_id ON latest_thread_snapshots (parent_id);
CREATE TABLE previous_thread_snapshots (
	id INTEGER NOT NULL REFERENCES latest_thread_snapshots (id),
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	name TEXT, -- the name of the channel (1-100 characters)
	rate_limit_per_user INTEGER, -- amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages or manage_channel, are unaffected
	owner_id INTEGER, -- ID of the creator of the thread
	thread_metadata__archived INTEGER, -- whether the thread is archived
	thread_metadata__auto_archive_duration INTEGER, -- the thread will stop showing in the channel list after auto_archive_duration minutes of inactivity, can be set to: 60, 1440, 4320, 10080
	thread_metadata__archive_timestamp INTEGER, -- timestamp when the thread's archive status was last changed, used for calculating recent activity
	thread_metadata__locked INTEGER, -- whether the thread is locked; when a thread is locked, only users with MANAGE_THREADS can unarchive it
	thread_metadata__invitable INTEGER, -- whether non-moderators can add other non-moderators to a thread; only available on private threads
	thread_metadata__create_timestamp INTEGER, -- timestamp when the thread was created; only populated for threads created after 2022-01-09
	flags INTEGER, -- channel flags combined as a bitfield
	applied_tags BLOB, -- IDs of the set of tags that have been applied to a thread in a GUILD_FORUM or a GUILD_MEDIA channel
	PRIMARY KEY (id, _timestamp)
) WITHOUT ROWID;

CREATE TABLE latest_forum_tag_snapshots (
	id INTEGER NOT NULL PRIMARY KEY,
	_deleted INTEGER,
	channel_id INTEGER REFERENCES latest_channel_snapshots (id), -- the ID of the forum channel
	---
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	name TEXT NOT NULL, -- the name of the tag (0-20 characters)
	moderated INTEGER NOT NULL, -- whether this tag can only be added to or removed from threads by a member with the MANAGE_THREADS permission
	emoji -- custom emoji ID (INTEGER) or Unicode emoji (TEXT)
);
CREATE TABLE previous_forum_tag_snapshots (
	id INTEGER NOT NULL REFERENCES latest_forum_tag_snapshots (id),
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	name TEXT NOT NULL, -- the name of the tag (0-20 characters)
	moderated INTEGER NOT NULL, -- whether this tag can only be added to or removed from threads by a member with the MANAGE_THREADS permission
	emoji, -- custom emoji ID (INTEGER) or Unicode emoji (TEXT)
	PRIMARY KEY (id, _timestamp)
);

-- TODO: Recipient list for DM channels and sticker properties


-- You can determine whether a message is from a webhook by comparing author__id with
-- 281474976710656 (2^48): if author__id is smaller, then it refers to a webhook user in
-- webhook_users; if it's bigger, then it refers to a normal user.
CREATE TABLE latest_message_snapshots (
	id INTEGER NOT NULL PRIMARY KEY,
	_deleted INTEGER,
	channel_id INTEGER NOT NULL, -- ID of the channel the message was sent in
	author__id INTEGER NOT NULL, -- ID of the user who sent the message or internal ID of the webhook user
	tts INTEGER NOT NULL, -- whether this was a TTS message
	type INTEGER NOT NULL, -- type of message
	message_reference__message_id INTEGER, -- ID of the originating message
	message_reference__channel_id INTEGER, -- ID of the originating message's channel
	message_reference__guild_id INTEGER, -- ID of the originating message's guild
	_sticker_ids BLOB NOT NULL, -- IDs of the stickers in the message, stored as 64-bit big-endian integers concatenated
	---
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	content TEXT, -- contents of the message
	edited_timestamp INTEGER, -- when this message was edited (or null if never)
	mention_everyone INTEGER NOT NULL, -- whether this message mentions everyone
	_mention_ids BLOB, -- IDs of users specifically mentioned in the message
	mention_roles BLOB, -- IDs of roles specifically mentioned in this message
	flags INTEGER, -- message flags combined as a bitfield
	_attachment_ids BLOB -- IDs of the attachments in the message, stored as 64-bit big-endian integers concatenated
);
CREATE INDEX message_by_channel_id ON latest_message_snapshots (channel_id);
CREATE VIRTUAL TABLE message_fts_index USING fts5(content, content=latest_message_snapshots, content_rowid=id, detail=full);
-- Triggers to keep the FTS index up to date
CREATE TRIGGER latest_message_snapshots_ai AFTER INSERT ON latest_message_snapshots BEGIN
  INSERT INTO message_fts_index (rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER latest_message_snapshots_ad AFTER DELETE ON latest_message_snapshots BEGIN
  INSERT INTO message_fts_index (message_fts_index, rowid, content) VALUES ('delete', old.id, old.content);
END;
CREATE TRIGGER latest_message_snapshots_au AFTER UPDATE ON latest_message_snapshots BEGIN
  INSERT INTO message_fts_index (message_fts_index, rowid, content) VALUES ('delete', old.id, old.content);
  INSERT INTO message_fts_index (rowid, content) VALUES (new.id, new.content);
END;
CREATE TABLE previous_message_snapshots (
	id INTEGER NOT NULL REFERENCES latest_message_snapshots (id),
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	content TEXT, -- contents of the message
	edited_timestamp INTEGER, -- When this message was edited (or null if never)
	mention_everyone INTEGER NOT NULL, -- whether this message mentions everyone
	_mention_ids BLOB, -- IDs of users specifically mentioned in the message
	mention_roles BLOB, -- IDs of roles specifically mentioned in this message
	flags INTEGER, -- message flags combined as a bitfield
	_attachment_ids BLOB, -- IDs of the attachments in the message, stored as 64-bit big-endian integers concatenated
	UNIQUE (id, _timestamp)
);

-- This table does not represent a Discord object. It's used to avoid repetition.
CREATE TABLE webhook_users (
	internal_id INTEGER NOT NULL PRIMARY KEY,
	webhook_id INTEGER NOT NULL,
	username TEXT NOT NULL,
	avatar BLOB,
	UNIQUE (webhook_id, username, avatar)
);

-- Apparently, all properties of attachments are immutable
CREATE TABLE attachments (
	id INTEGER NOT NULL PRIMARY KEY,
	_extra TEXT,
	_message_id INTEGER NOT NULL REFERENCES latest_message_snapshots (id), -- the ID of the parent message
	filename TEXT NOT NULL, -- name of file attached
	title TEXT, -- the original filename (before special characters get replaced) without the file extension
	description TEXT, -- description for the file
	content_type TEXT, -- the attachment's media type
	original_content_type TEXT,
	size INTEGER NOT NULL, -- size of file in bytes
	height INTEGER, -- height of file (if image)
	width INTEGER, -- width of file (if image)
	ephemeral INTEGER NOT NULL, -- whether this attachment is ephemeral
	duration_secs REAL, -- the duration of the audio file (currently for voice messages)
	waveform BLOB, -- byte array representing a sampled waveform, decoded from Base64 (currently for voice messages)
	flags INTEGER -- attachment flags combined as a bitfield
);

CREATE TABLE reactions (
	message_id INTEGER NOT NULL REFERENCES latest_message_snapshots (id),
	emoji NOT NULL, -- custom emoji ID (INTEGER) or Unicode emoji (TEXT)
	type INTEGER NOT NULL, -- 0 for normal reactions, 1 for super reactions
	user_id INTEGER NOT NULL REFERENCES latest_user_snapshots (id),
	start INTEGER NOT NULL, -- when this reaction was added, in _timestamp format, or 0 if the reaction was already there when the message was first archived
	end INTEGER -- when this reaction was removed, in _timestamp format, or NULL if it wasn't
);
CREATE INDEX reaction_index ON reactions (message_id, emoji, type);

CREATE TABLE reaction_emojis (
	id INTEGER NOT NULL PRIMARY KEY,
	name TEXT,
	animated INTEGER NOT NULL
);

CREATE TABLE latest_guild_emoji_snapshots (
	id INTEGER NOT NULL PRIMARY KEY,
	_deleted INTEGER,
	_guild_id INTEGER NOT NULL REFERENCES latest_guild_snapshots (id),
	user__id INTEGER REFERENCES latest_user_snapshots (id), -- ID of the user that created this emoji
	require_colons INTEGER NOT NULL, -- Whether this emoji must be wrapped in colons
	managed INTEGER NOT NULL, -- Whether this emoji is managed
	animated INTEGER NOT NULL, -- Whether this emoji is animated
	---
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	name TEXT NOT NULL,
	roles BLOB -- IDs of roles allowed to use this emoji
);
CREATE TABLE previous_guild_emoji_snapshots (
	id INTEGER NOT NULL REFERENCES latest_guild_emoji_snapshots (id),
	_timestamp INTEGER NOT NULL,
	_extra TEXT,
	name TEXT NOT NULL,
	roles BLOB, -- IDs of roles allowed to use this emoji
	PRIMARY KEY (id, _timestamp)
) WITHOUT ROWID;

-- Contains information about downloaded files. These may include attachments, profile pictures
-- and embedded media from external sites.
CREATE TABLE files (
	-- The query parameters of attachment URLs are removed before they are stored here.
	url TEXT NOT NULL PRIMARY KEY,
	-- content_hash is NULL if and only if error_code is not NULL.
	content_hash BLOB,
	-- error_code is NULL: no error
	-- error_code >= 0: normal HTTP error, error_code is the HTTP status code
	-- error_code == -1: malformed HTTP response
	--
	-- Normal HTTP errors often happen when an URL inside of an embed points to content which has
	-- since been removed.
	error_code INTEGER
) WITHOUT ROWID;
CREATE INDEX files_by_hash ON files (content_hash) WHERE content_hash IS NOT NULL;

COMMIT;
