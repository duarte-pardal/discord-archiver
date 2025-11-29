import test, { TestContext } from "node:test";
import assert from "node:assert/strict";
import { getRequestHandler, RequestHandler } from "./request-handler.js";
import { AddGuildMemberSnapshotRequest, AddGuildMemberLeaveRequest, AddSnapshotResult, GetChannelsRequest, GetForumTagsRequest, GetGuildEmojisRequest, GetGuildMembersRequest, GetGuildsRequest, GetMessagesRequest, GetRolesRequest, GetThreadsRequest, IteratorResponseFor, MarkMessageAsDeletedRequest, RequestType, SyncGuildMembersRequest, Timing, SetLastSyncedMessageIDRequest, GetLastSyncedMessageIDRequest, AddInitialReactionsRequest, AddReactionPlacementRequest, GetReactionsHistoryRequest as GetReactionHistoryRequest, MarkReactionAsRemovedRequest, MarkReactionAsRemovedBulkRequest, AddReactionResult, AddMessageSnapshotRequest, AddSnapshotRequest } from "./types.js";
import { Attachment, ChannelType, CustomEmoji, GatewayGuildCreateDispatchPayload, GuildMember, GuildMemberWithOptionalVoiceFields, MemberFlag, Message, PartialEmoji, PartialUser, ReactionType, User } from "../discord-api/types.js";
import { parseArgs } from "node:util";
import { unlinkSync } from "node:fs";
import { Logger } from "../util/log.js";
import { snowflakeToTimestamp } from "../discord-api/snowflake.js";

function snowflakeToIsoTimestamp(id: string | bigint) {
	return new Date(Number(snowflakeToTimestamp(BigInt(id)))).toISOString();
}

let fakeSnowflake = 2000000000000000000n;
function generateSnowflake(): string {
	return String(fakeSnowflake++);
}
function generateUser(): PartialUser {
	const id = generateSnowflake();
	const user = {
		avatar: null,
		avatar_decoration_data: null,
		bot: false,
		clan: null,
		collectibles: null,
		discriminator: "0",
		display_name: "Fake user",
		display_name_styles: null,
		global_name: "Fake user",
		id,
		primary_guild: null,
		public_flags: 0,
		username: `fake user ${id}`,
	};
	return user;
}
function generateGuildMember(): GuildMember {
	return {
		avatar: null,
		banner: null,
		communication_disabled_until: null,
		deaf: false,
		flags: 0,
		joined_at: "2025-10-23T00:00:00.000000+00:00",
		mute: false,
		nick: null,
		pending: false,
		premium_since: null,
		roles: [],
		user: generateUser(),
	};
}
function generateMessage(): Message {
	const id = generateSnowflake();
	return {
		type: 0,
		content: "hello",
		mentions: [],
		mention_roles: [],
		attachments: [],
		embeds: [],
		timestamp: snowflakeToIsoTimestamp(id),
		edited_timestamp: null,
		flags: 0,
		components: [],
		id,
		channel_id: "1367557310872031334",
		author: users[0],
		pinned: true,
		mention_everyone: false,
		tts: false,
	};
};

type RecursiveExtension<T> =
	T extends (infer ArrayMemberType)[] ? RecursiveExtension<ArrayMemberType>[] :
	T extends object ? {
		[Property in keyof T]: RecursiveExtension<T[Property]>;
	} & Record<string, unknown> :
	T;
type TestOptions = {
	name: string;
	skip?: boolean | string;
};

const guild: RecursiveExtension<GatewayGuildCreateDispatchPayload["d"]> = {
	large: false,
	roles: [
		{
			color: 0,
			colors: {
				primary_color: 0,
				secondary_color: null,
				tertiary_color: null,
			},
			flags: 0,
			hoist: false,
			icon: null,
			id: "1367557310418784356",
			managed: false,
			mentionable: false,
			name: "@everyone",
			permissions: "140737555530753",
			position: 0,
			tags: {},
			unicode_emoji: null,
			version: "1755899949343",
		},
		{
			color: 1752220,
			colors: {
				primary_color: 1752220,
				secondary_color: null,
				tertiary_color: null,
			},
			flags: 0,
			hoist: false,
			icon: null,
			id: "1367558991449817190",
			managed: false,
			mentionable: false,
			name: "simple role",
			permissions: "1024",
			position: 6,
			tags: {},
			unicode_emoji: null,
			version: "1755899331805",
		},
		{
			color: 3447003,
			colors: {
				primary_color: 3447003,
				secondary_color: null,
				tertiary_color: null,
			},
			flags: 0,
			hoist: false,
			icon: null,
			id: "1367559526748000416",
			managed: true,
			mentionable: false,
			name: "linked role",
			permissions: "0",
			position: 5,
			tags: {
				guild_connections: null,
			},
			unicode_emoji: null,
			version: "1755899331802",
		},
		{
			color: 0,
			colors: {
				primary_color: 0,
				secondary_color: null,
				tertiary_color: null,
			},
			flags: 0,
			hoist: false,
			icon: null,
			id: "1367563145002090553",
			managed: true,
			mentionable: false,
			name: "Archiver Test Bot",
			permissions: "1024",
			position: 4,
			tags: {
				bot_id: "1367562333853061130",
			},
			unicode_emoji: null,
			version: "1755899331799",
		},
		{
			color: 0,
			colors: {
				primary_color: 0,
				secondary_color: null,
				tertiary_color: null,
			},
			flags: 0,
			hoist: false,
			icon: null,
			id: "1407396263376326749",
			managed: true,
			mentionable: false,
			name: "AIRHORN SOLUTIONS",
			permissions: "3146752",
			position: 3,
			tags: {
				bot_id: "159800228088774656",
			},
			unicode_emoji: null,
			version: "1755899331796",
		},
		{
			color: 0,
			colors: {
				primary_color: 0,
				secondary_color: null,
				tertiary_color: null,
			},
			flags: 0,
			hoist: false,
			icon: null,
			id: "1407399735576236135",
			managed: true,
			mentionable: false,
			name: "Dank Memer",
			permissions: "2147871808",
			position: 2,
			tags: {
				bot_id: "270904126974590976",
			},
			unicode_emoji: null,
			version: "1755899331790",
		},
		{
			color: 0,
			colors: {
				primary_color: 0,
				secondary_color: null,
				tertiary_color: null,
			},
			flags: 0,
			hoist: false,
			icon: null,
			id: "1407483950473150537",
			managed: true,
			mentionable: false,
			name: "NQN",
			permissions: "1610968128",
			position: 1,
			tags: {
				bot_id: "559426966151757824",
			},
			unicode_emoji: null,
			version: "1755640723640",
		},
	],
	splash: null,
	afk_channel_id: null,
	profile: null,
	premium_features: null,
	nsfw: false,
	members: [
		{
			avatar: null,
			banner: null,
			communication_disabled_until: null,
			deaf: false,
			flags: 0,
			joined_at: "2025-05-01T18:07:41.962000+00:00",
			mute: false,
			nick: null,
			pending: false,
			premium_since: null,
			roles: [
				"1367563145002090553",
			],
			user: {
				avatar: null,
				avatar_decoration_data: null,
				bot: true,
				collectibles: null,
				discriminator: "0013",
				display_name: null,
				display_name_styles: null,
				global_name: null,
				id: "1367562333853061130",
				primary_guild: null,
				public_flags: 0,
				username: "Archiver Test Bot",
			},
		},
	],
	stickers: [],
	moderator_reporting: null,
	voice_states: [],
	mfa_level: 0,
	premium_subscription_count: 0,
	guild_scheduled_events: [],
	id: "1367557310418784356",
	inventory_settings: null,
	public_updates_channel_id: "1367558065943089234",
	features: [
		"NEWS",
		"COMMUNITY",
	],
	stage_instances: [],
	activity_instances: [],
	name: "Archiver Test Server",
	embedded_activities: [],
	default_message_notifications: 1,
	icon: null,
	safety_alerts_channel_id: null,
	incidents_data: null,
	presences: [],
	emojis: [
		{
			animated: false,
			available: true,
			id: "1367564352982356130",
			managed: false,
			name: "transparent",
			require_colons: true,
			roles: [],
			version: "1746123149929",
		},
		{
			animated: true,
			available: true,
			id: "1367564374880944139",
			managed: false,
			name: "random",
			require_colons: true,
			roles: [],
			version: "1746123155227",
		},
	],
	application_id: null,
	threads: [
		{
			flags: 0,
			guild_id: "1367557310418784356",
			id: "1407105149037576367",
			last_message_id: "1407105152078450748",
			member_count: 1,
			message_count: 1,
			name: "Public thread",
			owner_id: "1367556342314827907",
			parent_id: "1367557310872031334",
			rate_limit_per_user: 0,
			thread_metadata: {
				archive_timestamp: "2025-08-18T20:53:30.280000+00:00",
				archived: false,
				auto_archive_duration: 4320,
				create_timestamp: "2025-08-18T20:53:30.280000+00:00",
				invitable: true,
				locked: false,
			},
			total_message_sent: 1,
			type: 11,
		},
		{
			flags: 0,
			guild_id: "1367557310418784356",
			id: "1412186390422360208",
			last_message_id: "1412186603056533614",
			member_count: 1,
			message_count: 1,
			name: "Thread created from a message",
			owner_id: "1367556342314827907",
			parent_id: "1367557310872031334",
			rate_limit_per_user: 0,
			thread_metadata: {
				archive_timestamp: "2025-09-01T21:25:22.574432+00:00",
				archived: false,
				auto_archive_duration: 4320,
				create_timestamp: "2025-09-01T21:25:22.574432+00:00",
				locked: false,
			},
			total_message_sent: 1,
			type: 11,
		},
	],
	max_video_channel_users: 25,
	unavailable: false,
	premium_tier: 0,
	member_count: 7,
	max_members: 25000000,
	joined_at: "2025-05-01T18:07:41.962000+00:00",
	home_header: null,
	preferred_locale: "en-US",
	vanity_url_code: null,
	description: null,
	banner: null,
	lazy: true,
	application_command_counts: {},
	rules_channel_id: "1367557310872031334",
	region: "deprecated",
	discovery_splash: null,
	hub_type: null,
	max_stage_video_channel_users: 50,
	afk_timeout: 300,
	channels: [
		{
			flags: 0,
			id: "1367557310418784358",
			name: "Text Channels",
			permission_overwrites: [],
			position: 0,
			type: 4,
			version: "1746121470888",
		},
		{
			flags: 0,
			id: "1367557310872031333",
			name: "Voice Channels",
			permission_overwrites: [],
			position: 0,
			type: 4,
			version: "1746121470900",
		},
		{
			flags: 0,
			icon_emoji: {
				id: null,
				name: "👋",
			},
			id: "1367557310872031334",
			last_message_id: "1412189220306423808",
			last_pin_timestamp: "2025-05-01T18:26:08+00:00",
			name: "general",
			nsfw: false,
			parent_id: "1367557310418784358",
			permission_overwrites: [
				{
					allow: "377957435456",
					deny: "0",
					id: "1367557310418784356",
					type: 0,
				},
			],
			position: 0,
			rate_limit_per_user: 0,
			theme_color: null,
			topic: null,
			type: 0,
			version: "1755858331659",
		},
		{
			bitrate: 64000,
			flags: 0,
			icon_emoji: {
				id: null,
				name: "🎙",
			},
			id: "1367557310872031335",
			last_message_id: null,
			name: "General",
			parent_id: "1367557310872031333",
			permission_overwrites: [],
			position: 0,
			rate_limit_per_user: 0,
			rtc_region: null,
			status: null,
			type: 2,
			user_limit: 0,
			version: "1746121470930",
		},
		{
			flags: 0,
			id: "1367558065943089234",
			last_message_id: "1407105519633698956",
			name: "text-channel",
			parent_id: "1367557310418784358",
			permission_overwrites: [
				{
					allow: "1024",
					deny: "536870912",
					id: "1367556342314827907",
					type: 1,
				},
				{
					allow: "1024",
					deny: "536870912",
					id: "1367558991449817190",
					type: 0,
				},
				{
					allow: "0",
					deny: "0",
					id: "1367557310418784356",
					type: 0,
				},
			],
			position: 1,
			rate_limit_per_user: 0,
			topic: null,
			type: 0,
			version: "1746122605114",
		},
		{
			bitrate: 42000,
			flags: 0,
			id: "1367560202043527218",
			last_message_id: null,
			name: "Stage Channel",
			parent_id: "1367557310872031333",
			permission_overwrites: [],
			position: 0,
			rate_limit_per_user: 0,
			rtc_region: null,
			topic: null,
			type: 13,
			user_limit: 5000,
			version: "1746122236745",
		},
		{
			available_tags: [
				{
					color: null,
					emoji_id: null,
					emoji_name: null,
					id: "1367561291325247699",
					moderated: false,
					name: "Simple Tag",
				},
				{
					color: null,
					emoji_id: null,
					emoji_name: null,
					id: "1367561370408718406",
					moderated: true,
					name: "Mod-only Tag",
				},
			],
			default_forum_layout: 2,
			default_reaction_emoji: {
				emoji_id: null,
				emoji_name: "👍",
			},
			default_sort_order: 1,
			default_tag_setting: "match_some",
			flags: 0,
			id: "1367560896028610590",
			last_message_id: "1367561859141730304",
			name: "forum-channel",
			parent_id: "1367557310418784358",
			permission_overwrites: [
				{
					allow: "0",
					deny: "0",
					id: "1367557310418784356",
					type: 0,
				},
			],
			position: 3,
			rate_limit_per_user: 0,
			template: "",
			topic: "[forum channel post guidelines]",
			type: 15,
			version: "1746124580269",
		},
		{
			flags: 0,
			id: "1367562032794046646",
			last_message_id: null,
			name: "announcement-channel",
			parent_id: "1367557310418784358",
			permission_overwrites: [
				{
					allow: "0",
					deny: "2048",
					id: "1367557310418784356",
					type: 0,
				},
			],
			position: 2,
			rate_limit_per_user: 0,
			topic: null,
			type: 5,
			version: "1746122605127",
		},
	],
	premium_progress_bar_enabled: false,
	verification_level: 1,
	system_channel_flags: 15,
	latest_onboarding_question_id: null,
	owner_configured_content_level: 0,
	version: "1746123569055",
	owner_id: "1367556342314827907",
	nsfw_level: 0,
	explicit_content_filter: 2,
	soundboard_sounds: [],
	system_channel_id: "1367557310872031334",
};

// User objects as returned in the author field of messages.
const users: RecursiveExtension<Message["author"]>[] = [
	{
		id: "1367556342314827907",
		username: "archivertestserverowner_33925",
		avatar: null,
		discriminator: "0",
		public_flags: 0,
		flags: 0,
		banner: null,
		accent_color: null,
		global_name: "Archiver Test Server Owner",
		avatar_decoration_data: null,
		collectibles: null,
		display_name_styles: null,
		banner_color: null,
		clan: null,
		primary_guild: null,
	},
	{
		id: "1367562333853061130",
		username: "Archiver Test Bot",
		avatar: null,
		discriminator: "0013",
		public_flags: 0,
		flags: 0,
		bot: true,
		banner: null,
		accent_color: null,
		global_name: null,
		avatar_decoration_data: null,
		collectibles: null,
		banner_color: null,
		clan: null,
		primary_guild: null,
	},
];


type GuildMemberEntry = {
	options: TestOptions;
	data: RecursiveExtension<GuildMemberWithOptionalVoiceFields>;
};
const guildMembers: GuildMemberEntry[] = [
	{
		options: { name: "simple member" },
		data: {
			avatar: null,
			banner: null,
			communication_disabled_until: null,
			deaf: false,
			flags: 0,
			joined_at: "2025-05-01T17:44:30.825000+00:00",
			mute: false,
			nick: null,
			pending: false,
			premium_since: null,
			roles: [],
			user: {
				avatar: null,
				avatar_decoration_data: null,
				bot: false,
				collectibles: null,
				discriminator: "0",
				display_name: "Archiver Test Server Owner",
				display_name_styles: null,
				global_name: "Archiver Test Server Owner",
				id: "1367556342314827907",
				primary_guild: null,
				public_flags: 0,
				username: "archivertestserverowner_33925",
			},
		},
	},
	{
		options: { name: "pending member" },
		data: {
			avatar: null,
			banner: null,
			communication_disabled_until: null,
			deaf: false,
			flags: 1,
			joined_at: "2025-05-01T17:44:30.825000+00:00",
			mute: false,
			nick: null,
			pending: true,
			premium_since: null,
			roles: [],
			user: generateUser(),
		},
	},
	{
		options: { name: "member without the `deaf` and `mute` properties" },
		data: {
			avatar: null,
			banner: null,
			communication_disabled_until: null,
			flags: 0,
			joined_at: "2025-05-02T00:00:00.000000+00:00",
			nick: null,
			pending: false,
			premium_since: null,
			roles: [],
			user: generateUser(),
		},
	},
	{
		options: { name: "fake member with unknown properties" },
		data: {
			avatar: "00000000000000000000000000000000",
			banner: "11111111111111111111111111111111",
			communication_disabled_until: null,
			deaf: false,
			flags: 522 as MemberFlag,
			joined_at: "2023-01-01T12:34:56.789000+00:00",
			mute: true,
			nick: "name",
			pending: false,
			premium_since: "2023-02-01T12:34:56.789000+00:00",
			roles: [
				"1367558991449817190",
			],
			user: {
				avatar: "22222222222222222222222222222222",
				avatar_decoration_data: null,
				bot: false,
				collectibles: null,
				discriminator: "0",
				display_name: "User who boosted the server",
				display_name_styles: null,
				global_name: "User who boosted the server",
				id: generateSnowflake(),
				primary_guild: null,
				public_flags: 64,
				username: "special fake user 2",
			},
			123: "abc",
			collectibles: {
				nameplate: {
					sku_id: "1349849614198505602",
					asset: "nameplates/nameplates/twilight/",
					label: "COLLECTIBLES_NAMEPLATES_TWILIGHT_A11Y",
					palette: "cobalt",
					"huh?": false,
				},
				unknown_collectible: {},
			},
		},
	},
	{
		options: { name: "member with decorations" },
		data: {
			avatar: null,
			banner: null,
			communication_disabled_until: null,
			deaf: false,
			flags: 0,
			joined_at: "2025-11-15T00:00:00.000000+00:00",
			mute: false,
			nick: null,
			pending: false,
			premium_since: null,
			roles: [],
			user: generateUser(),
			avatar_decoration_data: {
				asset: "a_44d96dca4f514777925f23d841f36fac",
				sku_id: "1349486948942745695",
				expires_at: null,
			},
			collectibles: {
				nameplate: {
					sku_id: "1349849614198505602",
					asset: "nameplates/nameplates/twilight/",
					label: "COLLECTIBLES_NAMEPLATES_TWILIGHT_A11Y",
					palette: "cobalt",
				},
			},
			display_name_styles: {
				font_id: 3,
				effect_id: 2,
				colors: [
					1234567,
					7654321,
				],
			},
		},
	},
];

type MessageEntry = {
	options: TestOptions;
	deletedTiming?: Timing;
	data: RecursiveExtension<Message>;
};
const messages: MessageEntry[] = [
	{
		options: { name: "simple text message" },
		deletedTiming: {
			timestamp: new Date("2025-09-01T00:00:00Z").getTime(),
			realtime: false,
		},
		data: {
			type: 0,
			content: "Pinned message",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-05-01T18:26:04.685000+00:00",
			edited_timestamp: "2025-05-01T18:26:17.333000+00:00",
			flags: 0,
			components: [],
			id: "1367567770572558388",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: true,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "regular webhook message" },
		data: {
			type: 0,
			content: "Webhook message",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-05-03T15:31:24.207000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1368248587993092137",
			channel_id: "1367557310872031334",
			author: {
				id: "1368247842057224234",
				username: "Spidey Bot",
				avatar: "231c98afcd5adb3ef8363c49c511cc66",
				discriminator: "0000",
				public_flags: 0,
				flags: 0,
				bot: true,
				global_name: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			webhook_id: "1368247842057224234",
		},
	},
	{
		options: { name: "reply" },
		data: {
			type: 19,
			content: "Reply",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-17T22:49:07.354000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1406771857369206825",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 0,
				channel_id: "1367557310872031334",
				message_id: "1368248587993092137",
				guild_id: "1367557310418784356",
			},
			referenced_message: {
				type: 0,
				content: "Webhook message",
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [],
				timestamp: "2025-05-03T15:31:24.207000+00:00",
				edited_timestamp: null,
				flags: 0,
				components: [],
				id: "1368248587993092137",
				channel_id: "1367557310872031334",
				author: {
					id: "1368247842057224234",
					username: "Spidey Bot",
					avatar: "231c98afcd5adb3ef8363c49c511cc66",
					discriminator: "0000",
					public_flags: 0,
					flags: 0,
					bot: true,
					global_name: null,
					clan: null,
					primary_guild: null,
				},
				pinned: false,
				mention_everyone: false,
				tts: false,
				webhook_id: "1368247842057224234",
			},
		},
	},
	{
		options: { name: "reply to a deleted message" },
		data: {
			type: 19,
			content: "Reply to a deleted message",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-09-01T21:35:47.328000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1412189220306423808",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 0,
				channel_id: "1367557310872031334",
				message_id: "1412189126815387779",
				guild_id: "1367557310418784356",
			},
			referenced_message: null,
		},
	},
	{
		options: { name: "pin announcement" },
		data: {
			type: 6,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-05-01T18:26:08.593000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1367567786964160653",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 0,
				channel_id: "1367557310872031334",
				message_id: "1367567770572558388",
			},
			position: 0,
		},
	},
	{
		options: { name: "join announcement" },
		data: {
			type: 7,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-05-01T18:07:49.662000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1367563177713205298",
			channel_id: "1367557310872031334",
			author: {
				id: "1367562333853061130",
				username: "Archiver Test Bot",
				avatar: null,
				discriminator: "0013",
				public_flags: 0,
				flags: 0,
				bot: true,
				banner: null,
				accent_color: null,
				global_name: null,
				avatar_decoration_data: null,
				collectibles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "thread creation announcement" },
		data: {
			type: 18,
			content: "Public thread",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-18T20:53:30.280000+00:00",
			edited_timestamp: null,
			flags: 32,
			components: [],
			id: "1407105149037576367",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 0,
				channel_id: "1407105149037576367",
				guild_id: "1367557310418784356",
			},
			thread: {
				id: "1407105149037576367",
				type: 11,
				last_message_id: "1407105152078450748",
				flags: 0,
				guild_id: "1367557310418784356",
				name: "Public thread",
				parent_id: "1367557310872031334",
				rate_limit_per_user: 0,
				bitrate: 64000,
				user_limit: 0,
				rtc_region: null,
				owner_id: "1367556342314827907",
				thread_metadata: {
					archived: false,
					archive_timestamp: "2025-08-18T20:53:30.280000+00:00",
					auto_archive_duration: 4320,
					locked: false,
					create_timestamp: "2025-08-18T20:53:30.280000+00:00",
				},
				message_count: 1,
				member_count: 1,
				total_message_sent: 1,
				member_ids_preview: [
					"1367556342314827907",
				],
			},
		},
	},
	{
		options: { name: "message used to start a thread" },
		data: {
			type: 0,
			content: "A thread will be created from this message",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-09-01T21:24:32.631000+00:00",
			edited_timestamp: null,
			flags: 32,
			components: [],
			id: "1412186390422360208",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			thread: {
				id: "1412186390422360208",
				type: 11,
				last_message_id: "1412186603056533614",
				flags: 0,
				guild_id: "1367557310418784356",
				name: "Thread created from a message",
				parent_id: "1367557310872031334",
				rate_limit_per_user: 0,
				bitrate: 64000,
				user_limit: 0,
				rtc_region: null,
				owner_id: "1367556342314827907",
				thread_metadata: {
					archived: false,
					archive_timestamp: "2025-09-01T21:25:22.574000+00:00",
					auto_archive_duration: 4320,
					locked: false,
					create_timestamp: "2025-09-01T21:25:22.574000+00:00",
				},
				message_count: 1,
				member_count: 1,
				total_message_sent: 1,
			},
		},
	},
	{
		options: { name: "thread starter message" },
		data: {
			type: 21,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-09-01T21:25:22.587000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1412186599952875694",
			channel_id: "1412186390422360208",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 0,
				channel_id: "1367557310872031334",
				message_id: "1412186390422360208",
				guild_id: "1367557310418784356",
			},
			position: 0,
			referenced_message: {
				type: 0,
				content: "A thread will be created from this message",
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [],
				timestamp: "2025-09-01T21:24:32.631000+00:00",
				edited_timestamp: null,
				flags: 32,
				components: [],
				id: "1412186390422360208",
				channel_id: "1367557310872031334",
				author: {
					id: "1367556342314827907",
					username: "archivertestserverowner_33925",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Archiver Test Server Owner",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
				pinned: false,
				mention_everyone: false,
				tts: false,
				thread: {
					id: "1412186390422360208",
					type: 11,
					last_message_id: "1412186603056533614",
					flags: 0,
					guild_id: "1367557310418784356",
					name: "Thread created from a message",
					parent_id: "1367557310872031334",
					rate_limit_per_user: 0,
					bitrate: 64000,
					user_limit: 0,
					rtc_region: null,
					owner_id: "1367556342314827907",
					thread_metadata: {
						archived: false,
						archive_timestamp: "2025-09-01T21:25:22.574000+00:00",
						auto_archive_duration: 4320,
						locked: false,
						create_timestamp: "2025-09-01T21:25:22.574000+00:00",
					},
					message_count: 1,
					member_count: 1,
					total_message_sent: 1,
				},
			},
		},
	},
	{
		options: { name: "first message in thread" },
		data: {
			type: 0,
			content: "First message in the thread",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-18T20:53:31.005000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1407105152078450748",
			channel_id: "1407105149037576367",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "reply in thread" },
		data: {
			type: 19,
			content: "So true",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-11T20:35:18.461000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1426669514359181445",
			channel_id: "1407105149037576367",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 0,
				channel_id: "1407105149037576367",
				message_id: "1407105152078450748",
				guild_id: "1367557310418784356",
			},
			position: 1,
			referenced_message: {
				type: 0,
				content: "First message in the thread",
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [],
				timestamp: "2025-08-18T20:53:31.005000+00:00",
				edited_timestamp: null,
				flags: 0,
				components: [],
				id: "1407105152078450748",
				channel_id: "1407105149037576367",
				author: {
					id: "1367556342314827907",
					username: "archivertestserverowner_33925",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Archiver Test Server Owner",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
				pinned: false,
				mention_everyone: false,
				tts: false,
			},
		},
	},
	{
		options: { name: "forwarded message from the same channel" },
		data: {
			type: 0,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-18T20:55:21.300000+00:00",
			edited_timestamp: null,
			flags: 16384,
			components: [],
			id: "1407105614689206466",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 1,
				channel_id: "1367557310872031334",
				message_id: "1406771857369206825",
				guild_id: "1367557310418784356",
			},
			message_snapshots: [
				{
					message: {
						type: 19,
						content: "Reply",
						mentions: [],
						mention_roles: [],
						attachments: [],
						embeds: [],
						timestamp: "2025-08-17T22:49:07.354000+00:00",
						edited_timestamp: null,
						flags: 0,
						components: [],
					},
				},
			],
		},
	},
	{
		options: { name: "AutoMod message" },
		data: {
			type: 24,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [
				{
					type: "auto_moderation_notification",
					fields: [
						{
							name: "notification_type",
							value: "activity_alerts_enabled",
							inline: false,
						},
						{
							name: "action_by_user_id",
							value: "1367556342314827907",
							inline: false,
						},
					],
					content_scan_version: 0,
				},
			],
			timestamp: "2025-05-01T17:47:31.059000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1367558066522034318",
			channel_id: "1367557310872031334",
			author: {
				id: "1008776202191634432",
				username: "automod",
				avatar: null,
				discriminator: "0000",
				public_flags: 0,
				flags: 0,
				bot: true,
				system: true,
				banner: null,
				accent_color: null,
				global_name: "Automod",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "Community Updates message" },
		data: {
			type: 0,
			content: "This channel has been set up to receive official Discord announcements for admins and moderators of Community servers. We'll let you know about important updates, such as new moderation features or changes to your server's eligibility for Server Discovery, here.\n\nYou can change which channel these messages are sent to at any time inside Server Settings. We recommend choosing your staff channel, as some information may be sensitive to your server.\n\nThanks for choosing Discord as the place to build your community!",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-05-01T17:47:31.201000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1367558067117363372",
			channel_id: "1367557310872031334",
			author: {
				id: "669627189624307712",
				username: "Community Updates",
				avatar: "a0389d52d24fdef878aca87e8d52cc2a",
				discriminator: "0001",
				public_flags: 0,
				flags: 0,
				bot: true,
				system: true,
				banner: null,
				accent_color: null,
				global_name: "Community Updates",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "Tenor GIF" },
		data: {
			type: 0,
			content: "https://tenor.com/view/%D9%83%D8%B3%D9%85%D9%83-cats-cat-paw-gif-5925880593452544107",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [
				{
					type: "gifv",
					url: "https://tenor.com/view/%D9%83%D8%B3%D9%85%D9%83-cats-cat-paw-gif-5925880593452544107",
					provider: {
						name: "Tenor",
						url: "https://tenor.co",
					},
					thumbnail: {
						url: "https://media.tenor.com/Ujz1AMoesGsAAAAe/%D9%83%D8%B3%D9%85%D9%83-cats.png",
						proxy_url: "https://images-ext-1.discordapp.net/external/HnSnEhqRW8ZQipOjn7KwJXNxLAFlHiTtp0_tJGds3ZY/https/media.tenor.com/Ujz1AMoesGsAAAAe/%25D9%2583%25D8%25B3%25D9%2585%25D9%2583-cats.png",
						width: 444,
						height: 332,
						placeholder: "XhgGFYQCfMVMhnlpeWq3hsuguAuK",
						placeholder_version: 1,
						flags: 0,
					},
					video: {
						url: "https://media.tenor.com/Ujz1AMoesGsAAAPo/%D9%83%D8%B3%D9%85%D9%83-cats.mp4",
						proxy_url: "https://images-ext-1.discordapp.net/external/rhHeDrQomWtV4qVrup9yvY4uGStohTpwwJGlOYtLjG0/https/media.tenor.com/Ujz1AMoesGsAAAPo/%25D9%2583%25D8%25B3%25D9%2585%25D9%2583-cats.mp4",
						width: 444,
						height: 332,
						placeholder: "XhgGFYQCfMVMhnlpeWq3hsuguAuK",
						placeholder_version: 1,
						flags: 0,
					},
					content_scan_version: 2,
				},
			],
			timestamp: "2025-08-19T15:55:28.510000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1407392535323742249",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "message with embeds and legacy components" },
		data: {
			type: 0,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [
				{
					type: "rich",
					description: "Hello there... This is **Dank Memer**.\n-# Which of course if you can read, you knew already.\n\nOur bot has a lot going on for all types of gamers and servers.\n\n- **Global economy:** Grind, steal, and collect your way through hours of repeatable content and leaderboards.\n- **Gambling:** Multiple slot machines, roulette, snakeeyes, and more. Try and beat the casino and get rich through RNG.\n- **Fishing:** Collect em all, progress and upgrade yourself through skills, and meet NPCs (and again, leaderboards.)\n- **Fighting:** Wager your economy coins/items against other players in a pvp system with a light ranked system.\n- **Pets:** Take care of virtual pets, decorate the rooms they hang out in, fight with them, and more!\n- **Server Events:** Have people donate things to your server or donate them yourself, and run events to increase server activity. \n- And more...\n\nIf you're ready for some cool shit to do, the links below will get you started!",
					color: 5799256,
					image: {
						url: "https://imagedelivery.net/BLWzKjZx6tWuG7fpo67USA/930e67e2-9196-4c9d-119a-13751c611400/smaller",
						proxy_url: "https://images-ext-1.discordapp.net/external/GwszloYm6EumlC4p4mpjG_Tqwa9HHhToz9xxOLEcQZQ/https/imagedelivery.net/BLWzKjZx6tWuG7fpo67USA/930e67e2-9196-4c9d-119a-13751c611400/smaller",
						width: 912,
						height: 512,
						content_type: "image/png",
						placeholder: "T/cFBIIGKoJ3iYdBmYV89Ec/Pg==",
						placeholder_version: 1,
						flags: 0,
					},
				},
			],
			timestamp: "2025-08-19T16:24:05.522000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [
				{
					type: 1,
					id: 1,
					components: [
						{
							type: 2,
							id: 2,
							custom_id: "help-dm",
							style: 3,
							label: "Get Started",
							emoji: {
								id: "1236682122765533215",
								name: "memerAvatar",
							},
						},
						{
							type: 2,
							id: 3,
							style: 5,
							label: "Set Up",
							emoji: {
								id: "1044261612439212112",
								name: "Link",
							},
							url: "https://dankmemer.lol/dashboard/servers/1367557310418784356/settings",
						},
						{
							type: 2,
							id: 4,
							style: 5,
							label: "Website",
							emoji: {
								id: "1044261612439212112",
								name: "Link",
							},
							url: "https://dankmemer.lol",
						},
						{
							type: 2,
							id: 5,
							style: 5,
							label: "Support",
							emoji: {
								id: "1044261612439212112",
								name: "Link",
							},
							url: "https://discord.gg/dankmemerbot",
						},
					],
				},
			],
			resolved: {
				users: {},
				members: {},
				channels: {},
				roles: {},
			},
			id: "1407399736993911036",
			channel_id: "1367557310872031334",
			author: {
				id: "270904126974590976",
				username: "Dank Memer",
				avatar: "a_24778db4737114253ac3b30f45f1979f",
				discriminator: "5192",
				public_flags: 589824,
				flags: 589824,
				bot: true,
				banner: null,
				accent_color: null,
				global_name: null,
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "components v2 message" },
		data: {
			type: 20,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-19T16:24:51.224000+00:00",
			edited_timestamp: null,
			flags: 32768,
			components: [
				{
					type: 17,
					id: 1,
					accent_color: null,
					components: [
						{
							type: 10,
							id: 2,
							content: "### Market\n-# [How to partially fulfill orders ↗](https://dankmemer.lol/tutorial/partials)",
						},
						{
							type: 14,
							id: 3,
							spacing: 2,
							divider: true,
						},
						{
							type: 9,
							id: 4,
							components: [
								{
									type: 10,
									id: 5,
									content: "**Selling 2 <:Stocking:920812196567597067> Holiday Stocking**\n<:ReplyCont:870764844012412938> For: ⏣ 18,000,000\n<:ReplyCont:870764844012412938> Value per Unit: ⏣ 9,000,000\n<:ReplyCont:870764844012412938> Expires: <t:1755705281:R>\n<:Reply:870665583593660476> ID: DUUOM1",
								},
							],
							accessory: {
								type: 2,
								id: 6,
								custom_id: "market-accept:1367556342314827907:DUUOM1",
								style: 3,
								label: "Accept",
							},
						},
						{
							type: 9,
							id: 7,
							components: [
								{
									type: 10,
									id: 8,
									content: "**Selling 46 <:Stocking:920812196567597067> Holiday Stocking**\n<:ReplyCont:870764844012412938> For: ⏣ 460,000,000\n<:ReplyCont:870764844012412938> Value per Unit: ⏣ 10,000,000\n<:ReplyCont:870764844012412938> Partial Accepting Allowed\n<:ReplyCont:870764844012412938> Expires: <t:1755851092:R>\n<:Reply:870665583593660476> ID: KIXEBA",
								},
							],
							accessory: {
								type: 2,
								id: 9,
								custom_id: "market-accept:1367556342314827907:KIXEBA",
								style: 3,
								label: "Accept",
							},
						},
						{
							type: 9,
							id: 10,
							components: [
								{
									type: 10,
									id: 11,
									content: "**Selling 20 <:Stocking:920812196567597067> Holiday Stocking**\n<:ReplyCont:870764844012412938> For: ⏣ 240,000,000\n<:ReplyCont:870764844012412938> Value per Unit: ⏣ 12,000,000\n<:ReplyCont:870764844012412938> Expires: <t:1758034610:R>\n<:Reply:870665583593660476> ID: L96NEZ",
								},
							],
							accessory: {
								type: 2,
								id: 12,
								custom_id: "market-accept:1367556342314827907:L96NEZ",
								style: 3,
								label: "Accept",
							},
						},
						{
							type: 9,
							id: 13,
							components: [
								{
									type: 10,
									id: 14,
									content: "**Selling 14 <a:JackyOLanty:968850393431961630> Jacky o' Lanty**\n<:ReplyCont:870764844012412938> For: 140 <:Fossil:921790077393338378> Fossil\n<:ReplyCont:870764844012412938> Partial Accepting Allowed\n<:ReplyCont:870764844012412938> Expires: <t:1755988220:R>\n<:Reply:870665583593660476> ID: 5S9XH7",
								},
							],
							accessory: {
								type: 2,
								id: 15,
								custom_id: "market-accept:1367556342314827907:5S9XH7",
								style: 3,
								label: "Accept",
							},
						},
						{
							type: 14,
							id: 16,
							spacing: 2,
							divider: true,
						},
						{
							type: 10,
							id: 17,
							content: "-# Page 1 of 50",
						},
						{
							type: 1,
							id: 18,
							components: [
								{
									type: 3,
									id: 19,
									custom_id: "view:1:f:EvqJP2oCAIM:paginator-market-list:setFilter:0-1,0|-1|0|:0",
									min_values: 1,
									max_values: 8,
									options: [
										{
											label: "Buying",
											value: "0-0",
											default: true,
										},
										{
											label: "Selling",
											value: "0-1",
											default: true,
										},
										{
											label: "Mine",
											value: "0-2",
										},
										{
											label: "Allows Partial",
											value: "0-3",
										},
										{
											label: "For Coins",
											value: "0-4",
										},
										{
											label: "For Items",
											value: "0-5",
										},
										{
											label: "Pets",
											value: "0-6",
										},
										{
											label: "Items",
											value: "0-7",
										},
									],
								},
							],
						},
						{
							type: 1,
							id: 20,
							components: [
								{
									type: 3,
									id: 21,
									custom_id: "view:1:f:EvqJP2oCAIM:paginator-market-list:setFilter:0-1,0|-1|0|:1",
									min_values: 1,
									max_values: 1,
									options: [
										{
											label: "Fairness",
											value: "1-0",
											default: true,
										},
										{
											label: "Expiring Soon",
											value: "1-1",
										},
										{
											label: "Recently Posted",
											value: "1-2",
										},
									],
								},
							],
						},
						{
							type: 1,
							id: 22,
							components: [
								{
									type: 2,
									id: 23,
									custom_id: "view:1:f:EvqJP2oCAIM:paginator-market-list:setPage:0-1,0|-1|0|:0.0",
									style: 2,
									disabled: true,
									emoji: {
										id: "1379166455194718298",
										name: "DoubleArrowLeftui",
										animated: true,
									},
								},
								{
									type: 2,
									id: 24,
									custom_id: "view:1:f:EvqJP2oCAIM:paginator-market-list:setPage:0-1,0|-1|0|:0.00",
									style: 2,
									disabled: true,
									emoji: {
										id: "1379166002058756136",
										name: "ArrowLeftui",
										animated: true,
									},
								},
								{
									type: 2,
									id: 25,
									custom_id: "view:1:r:EvqJP2oCAIM:paginator-market-list:0-1,0|-1|0|",
									style: 2,
									emoji: {
										id: "1379166333689925652",
										name: "Refreshui",
										animated: true,
									},
								},
								{
									type: 2,
									id: 26,
									custom_id: "view:1:f:EvqJP2oCAIM:paginator-market-list:setPage:0-1,0|-1|0|:1.000",
									style: 2,
									emoji: {
										id: "1379166099895091251",
										name: "ArrowRightui",
										animated: true,
									},
								},
								{
									type: 2,
									id: 27,
									custom_id: "view:1:f:EvqJP2oCAIM:paginator-market-list:setPage:0-1,0|-1|0|:5.0000",
									style: 2,
									emoji: {
										id: "1379166551714041957",
										name: "DoubleArrowRightui",
										animated: true,
									},
								},
							],
						},
					],
					spoiler: false,
				},
			],
			resolved: {
				users: {},
				members: {},
				channels: {},
				roles: {},
			},
			id: "1407399928681992223",
			channel_id: "1367557310872031334",
			author: {
				id: "270904126974590976",
				username: "Dank Memer",
				avatar: "a_24778db4737114253ac3b30f45f1979f",
				discriminator: "5192",
				public_flags: 589824,
				flags: 589824,
				bot: true,
				banner: null,
				accent_color: null,
				global_name: null,
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			application_id: "270904126974590976",
			interaction: {
				id: "1407399926694023280",
				type: 2,
				name: "market view",
				user: {
					id: "1367556342314827907",
					username: "archivertestserverowner_33925",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Archiver Test Server Owner",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
			},
			webhook_id: "270904126974590976",
			interaction_metadata: {
				id: "1407399926694023280",
				type: 2,
				user: {
					id: "1367556342314827907",
					username: "archivertestserverowner_33925",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Archiver Test Server Owner",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
				authorizing_integration_owners: {
					0: "1367557310418784356",
				},
				name: "market view",
				command_type: 1,
			},
		},
	},
	{
		options: { name: "Not Quite Nitro webhook message" },
		data: {
			type: 0,
			content: "<a:nqn:780516123786608650>",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-19T21:59:41.643000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [
				{
					type: 1,
					id: 1,
					components: [
						{
							type: 2,
							id: 2,
							custom_id: "1.X.my_emotes.-1.0",
							style: 1,
							label: "Find emojis I can use",
							emoji: {
								id: "864259725205438474",
								name: "information",
							},
						},
					],
				},
			],
			resolved: {
				users: {},
				members: {},
				channels: {},
				roles: {},
			},
			id: "1407484194007027775",
			channel_id: "1367557310872031334",
			author: {
				id: "1407484190089543683",
				username: "Archiver Test Server Owner",
				avatar: "3cccbb43eabbdfa0c3206db27bd54840",
				discriminator: "0000",
				public_flags: 0,
				flags: 0,
				bot: true,
				global_name: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			application_id: "559426966151757824",
			webhook_id: "1407484190089543683",
		},
	},
	{
		options: { name: "another Not Quite Nitro webhook message" },
		data: {
			type: 0,
			content: "Look, this account can use NQN too! <a:nqn:780516123786608650>",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-22T10:26:03.444000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [
				{
					type: 1,
					id: 1,
					components: [
						{
							type: 2,
							id: 2,
							custom_id: "1.A.my_emotes.-1.0",
							style: 1,
							label: "Find emojis I can use",
							emoji: {
								id: "864259725205438474",
								name: "information",
							},
						},
					],
				},
			],
			resolved: {
				users: {},
				members: {},
				channels: {},
				roles: {},
			},
			id: "1408396798225285185",
			channel_id: "1367557310872031334",
			author: {
				id: "1407484190089543683",
				username: "Another Account",
				avatar: "8590f67a81573dff234be8168904f025",
				discriminator: "0000",
				public_flags: 0,
				flags: 0,
				bot: true,
				global_name: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			application_id: "559426966151757824",
			webhook_id: "1407484190089543683",
		},
	},
	{
		options: { name: "message with a sticker" },
		data: {
			type: 0,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-19T15:54:04.411000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			sticker_items: [
				{
					id: "751606491542192200",
					name: "Curious",
					format_type: 3,
				},
			],
			id: "1407392182586839203",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "@silent message" },
		data: {
			type: 0,
			content: "silent message",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-19T22:28:05.458000+00:00",
			edited_timestamp: null,
			flags: 4096,
			components: [],
			id: "1407491340324831283",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "message with an activity invitation" },
		data: {
			type: 23,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-08-22T12:50:49.718000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1408433231099068436",
			channel_id: "1367557310872031334",
			author: {
				id: "880218394199220334",
				username: "Watch Together",
				avatar: "fe2b7fa334817b0346d57416ad75e93b",
				discriminator: "5319",
				public_flags: 65536,
				flags: 65536,
				bot: true,
				banner: null,
				accent_color: null,
				global_name: null,
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			application: {
				id: "880218394199220334",
				name: "Watch Together",
				icon: "ec48acbad4c32efab4275cb9f3ca3a58",
				description: "Create and watch shared playlists of YouTube videos with your friends. Your choice to share the remote or not. ",
				type: null,
				cover_image: "3cc9446876ae9eec6e06ff565703c292",
				bot: {
					id: "880218394199220334",
					username: "Watch Together",
					avatar: "fe2b7fa334817b0346d57416ad75e93b",
					discriminator: "5319",
					public_flags: 65536,
					flags: 65536,
					bot: true,
					banner: null,
					accent_color: null,
					global_name: null,
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
				summary: "",
				is_monetized: false,
				is_verified: true,
				is_discoverable: true,
			},
			interaction: {
				id: "1408433230050365540",
				type: 2,
				name: "launch",
				user: {
					id: "1367556342314827907",
					username: "archivertestserverowner_33925",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Archiver Test Server Owner",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
			},
			webhook_id: "880218394199220334",
			activity_instance: {
				id: "i-1408433230050365540-gc-1367557310418784356-1367557310872031334",
			},
			interaction_metadata: {
				id: "1408433230050365540",
				type: 2,
				user: {
					id: "1367556342314827907",
					username: "archivertestserverowner_33925",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Archiver Test Server Owner",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
				authorizing_integration_owners: {
					1: "1367556342314827907",
				},
				name: "launch",
				command_type: 4,
			},
		},
	},
	{
		options: { name: "message with attachments" },
		deletedTiming: {
			timestamp: new Date("2025-09-01T01:00:00Z").getTime(),
			realtime: true,
		},
		data: {
			type: 0,
			content: "This message has attachments",
			mentions: [],
			mention_roles: [],
			attachments: [
				{
					id: "1408914538673209394",
					filename: "audio.ogg",
					size: 6139,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914538673209394/audio.ogg?ex=68ab796a&is=68aa27ea&hm=d9187f1f7528d36d0a9900c480914c69b677275707df09f94eaf7d69311789c1&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914538673209394/audio.ogg?ex=68ab796a&is=68aa27ea&hm=d9187f1f7528d36d0a9900c480914c69b677275707df09f94eaf7d69311789c1&",
					content_type: "audio/ogg",
					original_content_type: "application/ogg",
					content_scan_version: 2,
				},
				{
					id: "1408914539084513380",
					filename: "image.png",
					size: 1321,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914539084513380/image.png?ex=68ab796a&is=68aa27ea&hm=9795c09d667439a56d21563e94875bf02fa84aafac657673debffea84757739d&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914539084513380/image.png?ex=68ab796a&is=68aa27ea&hm=9795c09d667439a56d21563e94875bf02fa84aafac657673debffea84757739d&",
					width: 768,
					height: 576,
					content_type: "image/png",
					original_content_type: "image/png",
					content_scan_version: 2,
					placeholder: "2gcWRZKfi4iIiIiHeIiIeI+ICIiI",
					placeholder_version: 1,
				},
				{
					id: "1408914539440767068",
					filename: "Filename_with_special_characters_and_.txt",
					size: 13,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914539440767068/Filename_with_special_characters_and_.txt?ex=68ab796a&is=68aa27ea&hm=69a377c3038b06866d9488398dbe1e49622712e5d738ab07045c2971a89be623&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914539440767068/Filename_with_special_characters_and_.txt?ex=68ab796a&is=68aa27ea&hm=69a377c3038b06866d9488398dbe1e49622712e5d738ab07045c2971a89be623&",
					content_type: "text/plain; charset=utf-8",
					original_content_type: "text/plain",
					content_scan_version: 2,
					title: "Filename with «spécial» 日本語 characters and 🿿!",
				},
				{
					id: "1408914540024037447",
					filename: "video.mp4",
					size: 12711,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=68ab796a&is=68aa27ea&hm=742760717a37a347b450f21dc4984b34055cdb0d0b6de6af960d832196dc1549&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=68ab796a&is=68aa27ea&hm=742760717a37a347b450f21dc4984b34055cdb0d0b6de6af960d832196dc1549&",
					width: 320,
					height: 240,
					content_type: "video/mp4",
					original_content_type: "video/mp4",
					content_scan_version: 2,
					placeholder: "3/cNLYZ1cIB3Z3dHaHiId4AouK+I",
					placeholder_version: 1,
				},
				{
					id: "1408914540288016436",
					filename: "deleted.txt",
					size: 13,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540288016436/deleted.txt?ex=68ab796a&is=68aa27ea&hm=c5d1ebf4dca6b0ac608b2288ca18ce5b4b7d165ef83df7e13a461646e96783fb&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914540288016436/deleted.txt?ex=68ab796a&is=68aa27ea&hm=c5d1ebf4dca6b0ac608b2288ca18ce5b4b7d165ef83df7e13a461646e96783fb&",
					content_type: "text/plain; charset=utf-8",
					original_content_type: "text/plain",
					content_scan_version: 2,
				},
			],
			embeds: [],
			timestamp: "2025-08-23T20:43:22.839000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1408914540573364234",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "message with unknown properties" },
		data: {
			type: 0,
			content: "hello",
			mentions: [],
			mention_roles: [],
			attachments: [{
				id: "1408921187987357839",
				filename: "file.txt",
				size: 100,
				url: "",
				proxy_url: "",
				unknown_property_in_attachment: {
					false: false,
				},
			}],
			embeds: [],
			timestamp: "2025-08-23T21:09:47.706000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1408921187987357838",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			interaction: {
				id: "1408921187987357837",
				type: 2,
				user: {
					id: "1367556342314827907",
					username: "archivertestserverowner_33925",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Archiver Test Server Owner",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
				name: "test",
			},
			interaction_metadata: {
				id: "1408921187987357837",
				type: 2,
				user: {
					id: "1367556342314827907",
					username: "archivertestserverowner_33925",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Archiver Test Server Owner",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
				authorizing_integration_owners: {
					1: "1367556342314827907",
				},
				name: "test",
				command_type: 4,
				unknown_property_in_interaction_metadata: null,
			},
			unknown_property_in_message: [{
				string: "string",
				number: 123,
				boolean: true,
				null: null,
			}],
		},
	},
	{
		options: { name: "finalized poll" },
		data: {
			type: 0,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-09-01T10:56:39.831000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1412028379246362634",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			poll: {
				question: {
					text: "Do you like chocolate?",
				},
				answers: [
					{
						answer_id: 1,
						poll_media: {
							text: "Yes",
						},
					},
					{
						answer_id: 2,
						poll_media: {
							text: "No",
						},
					},
				],
				expiry: "2025-09-01T11:56:39.793726+00:00",
				allow_multiselect: false,
				layout_type: 1,
				results: {
					answer_counts: [
						{
							id: 2,
							count: 0,
							me_voted: false,
						},
						{
							id: 1,
							count: 1,
							me_voted: false,
						},
					],
					is_finalized: true,
				},
			},
		},
	},
	{
		options: { name: "ongoing poll" },
		data: {
			type: 0,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-09-01T11:05:47.362000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1412030675757830235",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			poll: {
				question: {
					text: "Which devices do you have?",
				},
				answers: [
					{
						answer_id: 1,
						poll_media: {
							text: "Smartphone",
						},
					},
					{
						answer_id: 2,
						poll_media: {
							text: "Tablet",
						},
					},
					{
						answer_id: 3,
						poll_media: {
							text: "Laptop computer",
						},
					},
					{
						answer_id: 4,
						poll_media: {
							text: "Desktop computer",
						},
					},
				],
				expiry: "2025-09-02T11:05:47.353223+00:00",
				allow_multiselect: true,
				layout_type: 1,
				results: {
					answer_counts: [
						{
							id: 1,
							count: 1,
							me_voted: false,
						},
						{
							id: 4,
							count: 1,
							me_voted: false,
						},
					],
					is_finalized: false,
				},
			},
		},
	},
	{
		options: { name: "poll result announcement" },
		data: {
			type: 46,
			content: "",
			mentions: [
				{
					id: "1367556342314827907",
					username: "archivertestserverowner_33925",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Archiver Test Server Owner",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
			],
			mention_roles: [],
			attachments: [],
			embeds: [
				{
					type: "poll_result",
					fields: [
						{
							name: "poll_question_text",
							value: "Do you like chocolate?",
							inline: false,
						},
						{
							name: "victor_answer_votes",
							value: "1",
							inline: false,
						},
						{
							name: "total_votes",
							value: "1",
							inline: false,
						},
						{
							name: "victor_answer_id",
							value: "1",
							inline: false,
						},
						{
							name: "victor_answer_text",
							value: "Yes",
							inline: false,
						},
					],
					content_scan_version: 0,
				},
			],
			timestamp: "2025-09-01T11:56:41.582000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1412043486085120161",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 0,
				channel_id: "1367557310872031334",
				message_id: "1412028379246362634",
			},
		},
	},
	{
		options: { name: "message from user with decorations" },
		data: (() => {
			const id = generateSnowflake();
			const clan = {
				identity_guild_id: generateSnowflake(),
				identity_enabled: true,
				tag: "FAKE",
				badge: "00000000000000000000000000000000",
			};
			return {
				type: 0,
				content: "Look at my bling!",
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [],
				timestamp: snowflakeToIsoTimestamp(id),
				edited_timestamp: null,
				flags: 0,
				components: [],
				id,
				channel_id: "1367557310872031334",
				author: {
					id: generateSnowflake(),
					username: "fake user with decorations",
					avatar: "00000000000000000000000000000000",
					discriminator: "0",
					public_flags: 4194560,
					flags: 4194560,
					banner: null,
					accent_color: null,
					global_name: "User with fancy decorations",
					avatar_decoration_data: {
						asset: "a_44d96dca4f514777925f23d841f36fac",
						sku_id: "1349486948942745695",
						expires_at: null,
					},
					collectibles: {
						nameplate: {
							sku_id: "1349849614198505602",
							asset: "nameplates/nameplates/twilight/",
							label: "COLLECTIBLES_NAMEPLATES_TWILIGHT_A11Y",
							palette: "cobalt",
						},
					},
					display_name_styles: {
						font_id: 3,
						effect_id: 2,
						colors: [
							1234567,
							7654321,
						],
					},
					banner_color: null,
					clan,
					primary_guild: clan,
				},
				pinned: true,
				mention_everyone: false,
				tts: false,
			};
		})(),
	},
	{
		options: { name: "message from user with unknown properties" },
		data: (() => {
			const id = generateSnowflake();
			return {
				type: 0,
				content: "Pinned message",
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [],
				timestamp: snowflakeToIsoTimestamp(id),
				edited_timestamp: "2025-05-01T18:26:17.333000+00:00",
				flags: 0,
				components: [],
				id,
				channel_id: "1367557310872031334",
				author: {
					id: generateSnowflake(),
					username: "fake user with unknown properties",
					avatar: "invalid image hash",
					discriminator: "0",
					public_flags: 4194560,
					flags: 4194560,
					banner: null,
					accent_color: null,
					global_name: "User with unknown properties",
					avatar_decoration_data: null,
					collectibles: {
						nameplate: {
							sku_id: "1349849614198505602",
							asset: "nameplates/nameplates/twilight/",
							label: "COLLECTIBLES_NAMEPLATES_TWILIGHT_A11Y",
							palette: "cobalt",
							"what?": true,
						},
						unknown_collectible: {},
					},
					display_name_styles: null,
					banner_color: null,
					clan: {
						identity_guild_id: null,
						identity_enabled: null,
						tag: null,
						badge: null,
						unknown_property: 123,
					},
					primary_guild: {
						identity_guild_id: null,
						identity_enabled: null,
						tag: null,
						badge: null,
						unknown_property: 123,
					},
					unknown_property: [],
				},
				pinned: true,
				mention_everyone: false,
				tts: false,
			};
		})(),
	},
	{
		options: { name: "follow add announcement" },
		data: 	{
			type: 12,
			content: "Archiver Test Server #announcement-channel",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-11T21:01:32.684000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1426676117129138337",
			channel_id: "1367557310872031334",
			author: {
				id: "1200964506852012183",
				username: "another_acc_archiver_test",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Another Account",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 0,
				channel_id: "1367562032794046646",
				guild_id: "1367557310418784356",
			},
		},
	},
	{
		options: { name: "message in announcement channel" },
		data: {
			type: 0,
			content: "This message was sent in the announcement channel",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-11T21:50:07.459000+00:00",
			edited_timestamp: null,
			flags: 1,
			components: [],
			id: "1426688342581575832",
			channel_id: "1367562032794046646",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "crossposted message" },
		data: {
			type: 0,
			content: "This message was sent in the announcement channel",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-11T21:50:10.565000+00:00",
			edited_timestamp: null,
			flags: 2,
			components: [],
			id: "1426688355608956949",
			channel_id: "1367557310872031334",
			author: {
				id: "1426676116478758932",
				username: "Archiver Test Server #announcement-channel",
				avatar: "95ab8c48fea2f25d538963dbd34a9332",
				discriminator: "0000",
				public_flags: 0,
				flags: 0,
				bot: true,
				global_name: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			webhook_id: "1426676116478758932",
			message_reference: {
				type: 0,
				channel_id: "1367562032794046646",
				message_id: "1426688342581575832",
				guild_id: "1367557310418784356",
			},
		},
	},
	{
		options: { name: "forwarded message from a different channel in the same server" },
		data: {
			type: 0,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-15T13:50:25.717000+00:00",
			edited_timestamp: null,
			flags: 16384,
			components: [],
			id: "1428017174668378284",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 1,
				channel_id: "1367562032794046646",
				message_id: "1426688342581575832",
				guild_id: "1367557310418784356",
			},
			message_snapshots: [
				{
					message: {
						type: 0,
						content: "This message was sent in the announcement channel",
						mentions: [],
						mention_roles: [],
						attachments: [],
						embeds: [],
						timestamp: "2025-10-11T21:50:07.459000+00:00",
						edited_timestamp: null,
						flags: 1,
						components: [],
					},
				},
			],
		},
	},
	{
		options: { name: "forwarded message from a different server" },
		data: {
			type: 0,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-15T13:53:27.844000+00:00",
			edited_timestamp: null,
			flags: 16384,
			components: [],
			id: "1428017938564255818",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
			message_reference: {
				type: 1,
				channel_id: "1428017879634284546",
				message_id: "1428017920558239786",
				guild_id: "1428017878442967073",
			},
			message_snapshots: [
				{
					message: {
						type: 0,
						content: "Hello!",
						mentions: [],
						mention_roles: [],
						attachments: [],
						embeds: [],
						timestamp: "2025-10-15T13:53:23.551000+00:00",
						edited_timestamp: null,
						flags: 0,
						components: [],
					},
				},
			],
		},
	},
	{
		options: { name: "message that mentions a user" },
		data: {
			type: 0,
			content: "Hey <@1200964506852012183>, come look at this.",
			mentions: [
				{
					id: "1200964506852012183",
					username: "another_acc_archiver_test",
					avatar: null,
					discriminator: "0",
					public_flags: 0,
					flags: 0,
					banner: null,
					accent_color: null,
					global_name: "Another Account",
					avatar_decoration_data: null,
					collectibles: null,
					display_name_styles: null,
					banner_color: null,
					clan: null,
					primary_guild: null,
				},
			],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-15T22:08:28.508000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1428142512178073712",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "message that mentions @everyone" },
		data: {
			type: 0,
			content: "@everyone get pinged lol",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-15T22:09:25.111000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1428142749588131921",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: true,
			tts: false,
		},
	},
	{
		options: { name: "message that mentions a role" },
		data: {
			type: 0,
			content: "I can ping <@&1367558991449817190>.",
			mentions: [],
			mention_roles: [
				"1367558991449817190",
			],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-15T22:10:04.080000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1428142913035960322",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "message with a failed attempt at mentioning @everyone" },
		data: {
			type: 0,
			content: "I can't ping @everyone.",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-15T22:12:29.060000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1428143521126289549",
			channel_id: "1367557310872031334",
			author: {
				id: "1200964506852012183",
				username: "another_acc_archiver_test",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Another Account",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "message with a failed attempt at mentioning a role" },
		data: {
			type: 0,
			content: "I can't ping <@&1367558991449817190>.",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [],
			timestamp: "2025-10-15T22:11:31.917000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1428143281451302983",
			channel_id: "1367557310872031334",
			author: {
				id: "1200964506852012183",
				username: "another_acc_archiver_test",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Another Account",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "embedded video from attachment" },
		data: {
			type: 0,
			content: "Embedded video from attachment\nhttps://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
			mentions: [],
			mention_roles: [],
			attachments: [],
			embeds: [
				{
					type: "video",
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
					video: {
						url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
						proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
						width: 320,
						height: 240,
						content_type: "video/mp4",
						placeholder: "3/cNLYZ1cIB3Z3dHaHiId4AouK+I",
						placeholder_version: 1,
						flags: 0,
					},
					content_scan_version: 2,
				},
			],
			timestamp: "2025-11-13T11:47:53.322000+00:00",
			edited_timestamp: null,
			flags: 0,
			components: [],
			id: "1438495584590762066",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "voice message" },
		data: {
			type: 0,
			content: "",
			mentions: [],
			mention_roles: [],
			attachments: [
				{
					id: "1439050325138079844",
					filename: "voice-message.ogg",
					size: 10725,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1439050325138079844/voice-message.ogg?ex=69191b8d&is=6917ca0d&hm=e07910cca1de9a399ab472558aa2cc2c53f8f2ee5a58bf314a2c9baa3d884b9f&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1439050325138079844/voice-message.ogg?ex=69191b8d&is=6917ca0d&hm=e07910cca1de9a399ab472558aa2cc2c53f8f2ee5a58bf314a2c9baa3d884b9f&",
					duration_secs: 2.9200000762939453,
					waveform: "ZgAAYxFzEABXen97CC8pBQAAAACDmIJkZQAAKA==",
					content_type: "audio/ogg",
					content_scan_version: 0,
				},
			],
			embeds: [],
			timestamp: "2025-11-15T00:32:13.838000+00:00",
			edited_timestamp: null,
			flags: 8192,
			components: [],
			id: "1439050325402063080",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
];

const messageEdits: {
	options: TestOptions;
	timestamp: number;
	data: RecursiveExtension<Message>;
}[] = [
	{
		options: { name: "removing an attachment" },
		timestamp: new Date("2025-08-23T20:50:25Z").getTime(),
		data: {
			type: 0,
			content: "This message has attachments",
			mentions: [],
			mention_roles: [],
			attachments: [
				{
					id: "1408914538673209394",
					filename: "audio.ogg",
					size: 6139,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914538673209394/audio.ogg?ex=68ab796a&is=68aa27ea&hm=d9187f1f7528d36d0a9900c480914c69b677275707df09f94eaf7d69311789c1&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914538673209394/audio.ogg?ex=68ab796a&is=68aa27ea&hm=d9187f1f7528d36d0a9900c480914c69b677275707df09f94eaf7d69311789c1&",
					content_type: "audio/ogg",
					original_content_type: "application/ogg",
					content_scan_version: 2,
				},
				{
					id: "1408914539084513380",
					filename: "image.png",
					size: 1321,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914539084513380/image.png?ex=68ab796a&is=68aa27ea&hm=9795c09d667439a56d21563e94875bf02fa84aafac657673debffea84757739d&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914539084513380/image.png?ex=68ab796a&is=68aa27ea&hm=9795c09d667439a56d21563e94875bf02fa84aafac657673debffea84757739d&",
					width: 768,
					height: 576,
					content_type: "image/png",
					original_content_type: "image/png",
					content_scan_version: 2,
					placeholder: "2gcWRZKfi4iIiIiHeIiIeI+ICIiI",
					placeholder_version: 1,
				},
				{
					id: "1408914539440767068",
					filename: "Filename_with_special_characters_and_.txt",
					size: 13,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914539440767068/Filename_with_special_characters_and_.txt?ex=68ab796a&is=68aa27ea&hm=69a377c3038b06866d9488398dbe1e49622712e5d738ab07045c2971a89be623&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914539440767068/Filename_with_special_characters_and_.txt?ex=68ab796a&is=68aa27ea&hm=69a377c3038b06866d9488398dbe1e49622712e5d738ab07045c2971a89be623&",
					content_type: "text/plain; charset=utf-8",
					original_content_type: "text/plain",
					content_scan_version: 2,
					title: "Filename with «spécial» 日本語 characters and 🿿!",
				},
				{
					id: "1408914540024037447",
					filename: "video.mp4",
					size: 12711,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=68ab796a&is=68aa27ea&hm=742760717a37a347b450f21dc4984b34055cdb0d0b6de6af960d832196dc1549&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=68ab796a&is=68aa27ea&hm=742760717a37a347b450f21dc4984b34055cdb0d0b6de6af960d832196dc1549&",
					width: 320,
					height: 240,
					content_type: "video/mp4",
					original_content_type: "video/mp4",
					content_scan_version: 2,
					placeholder: "3/cNLYZ1cIB3Z3dHaHiId4AouK+I",
					placeholder_version: 1,
				},
			],
			embeds: [],
			timestamp: "2025-08-23T20:43:22.839000+00:00",
			edited_timestamp: "2025-08-23T20:50:24.576000+00:00",
			flags: 0,
			components: [],
			id: "1408914540573364234",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
	{
		options: { name: "editing the content" },
		timestamp: new Date("2025-08-23T20:58:10Z").getTime(),
		data: {
			type: 0,
			content: "This message has 4 attachments but used to have 5",
			mentions: [],
			mention_roles: [],
			attachments: [
				{
					id: "1408914538673209394",
					filename: "audio.ogg",
					size: 6139,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914538673209394/audio.ogg?ex=68ab796a&is=68aa27ea&hm=d9187f1f7528d36d0a9900c480914c69b677275707df09f94eaf7d69311789c1&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914538673209394/audio.ogg?ex=68ab796a&is=68aa27ea&hm=d9187f1f7528d36d0a9900c480914c69b677275707df09f94eaf7d69311789c1&",
					content_type: "audio/ogg",
					original_content_type: "application/ogg",
					content_scan_version: 2,
				},
				{
					id: "1408914539084513380",
					filename: "image.png",
					size: 1321,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914539084513380/image.png?ex=68ab796a&is=68aa27ea&hm=9795c09d667439a56d21563e94875bf02fa84aafac657673debffea84757739d&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914539084513380/image.png?ex=68ab796a&is=68aa27ea&hm=9795c09d667439a56d21563e94875bf02fa84aafac657673debffea84757739d&",
					width: 768,
					height: 576,
					content_type: "image/png",
					original_content_type: "image/png",
					content_scan_version: 2,
					placeholder: "2gcWRZKfi4iIiIiHeIiIeI+ICIiI",
					placeholder_version: 1,
				},
				{
					id: "1408914539440767068",
					filename: "Filename_with_special_characters_and_.txt",
					size: 13,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914539440767068/Filename_with_special_characters_and_.txt?ex=68ab796a&is=68aa27ea&hm=69a377c3038b06866d9488398dbe1e49622712e5d738ab07045c2971a89be623&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914539440767068/Filename_with_special_characters_and_.txt?ex=68ab796a&is=68aa27ea&hm=69a377c3038b06866d9488398dbe1e49622712e5d738ab07045c2971a89be623&",
					content_type: "text/plain; charset=utf-8",
					original_content_type: "text/plain",
					content_scan_version: 2,
					title: "Filename with «spécial» 日本語 characters and 🿿!",
				},
				{
					id: "1408914540024037447",
					filename: "video.mp4",
					size: 12711,
					url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=68ab796a&is=68aa27ea&hm=742760717a37a347b450f21dc4984b34055cdb0d0b6de6af960d832196dc1549&",
					proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=68ab796a&is=68aa27ea&hm=742760717a37a347b450f21dc4984b34055cdb0d0b6de6af960d832196dc1549&",
					width: 320,
					height: 240,
					content_type: "video/mp4",
					original_content_type: "video/mp4",
					content_scan_version: 2,
					placeholder: "3/cNLYZ1cIB3Z3dHaHiId4AouK+I",
					placeholder_version: 1,
				},
			],
			embeds: [],
			timestamp: "2025-08-23T20:43:22.839000+00:00",
			edited_timestamp: "2025-08-23T20:58:09.666000+00:00",
			flags: 0,
			components: [],
			id: "1408914540573364234",
			channel_id: "1367557310872031334",
			author: {
				id: "1367556342314827907",
				username: "archivertestserverowner_33925",
				avatar: null,
				discriminator: "0",
				public_flags: 0,
				flags: 0,
				banner: null,
				accent_color: null,
				global_name: "Archiver Test Server Owner",
				avatar_decoration_data: null,
				collectibles: null,
				display_name_styles: null,
				banner_color: null,
				clan: null,
				primary_guild: null,
			},
			pinned: false,
			mention_everyone: false,
			tts: false,
		},
	},
];

function deleteNullPropsRecursive(actual: any, expected: any) {
	for (const key in actual) {
		if (expected[key] === undefined && actual[key] === null) {
			delete actual[key];
		} else if (typeof expected[key] === "object" && expected[key] !== null && typeof actual[key] === "object" && actual[key] !== null) {
			deleteNullPropsRecursive(actual[key], expected[key]);
		}
	}
}

function assertEqual(
	{ actual, expected, message, excludeKeys = [] }:
	{
		actual: any;
		expected: any;
		message?: string | Error;
		excludeKeys?: Iterable<string>;
	},
) {
	if (typeof expected !== "object" || expected === null || expected instanceof Array) {
		assert.deepEqual(actual, expected, message);
	} else {
		expected = structuredClone(expected);
		// This also removes entries with the value `undefined`
		actual = JSON.parse(JSON.stringify(actual));
		for (const key of excludeKeys) {
			delete actual[key];
			delete expected[key];
		}
		deleteNullPropsRecursive(actual, expected);
		assert.deepEqual(actual, expected, message);
	}
}

const { values: args } = parseArgs({
	options: {
		database: {
			type: "string",
			short: "d",
			default: ":memory:",
		},
	},
});
if (args.database !== ":memory:") {
	try {
		unlinkSync(args.database);
	} catch {}
}


const log: Logger = {
	log() {},
	maxLevelNumber: 0,
	setLevel() {},
	error: undefined,
	warning: undefined,
	info: undefined,
	verbose: undefined,
	debug: undefined,
};
const requestHandler = getRequestHandler({ path: args.database, log });
const request = ((req: any) => {
	return requestHandler(structuredClone(req));
}) as RequestHandler;


const guildSnapshotTiming = {
	timestamp: 1000,
	realtime: false,
};

await test("adding snapshots works", async (t) => {
	function addSnapshot(req: AddSnapshotRequest) {
		assert.equal(request(req), AddSnapshotResult.AddedFirstSnapshot);
		assert.equal(request(req), AddSnapshotResult.SameAsLatest);
	}

	await t.test("adding guild snapshots works", async (t) => {
		await t.test("community server", () => {
			addSnapshot({
				type: RequestType.AddGuildSnapshot,
				guild: guild,
				timing: guildSnapshotTiming,
			});
		});
	});
	await t.test("adding emoji snapshots works", async (t) => {
		for (const emoji of guild.emojis) {
			await t.test(emoji.name, () => {
				addSnapshot({
					type: RequestType.AddGuildEmojiSnapshot,
					emoji,
					guildID: guild.id,
					timing: guildSnapshotTiming,
				});
			});
		}
	});
	await t.test("adding role snapshots works", async (t) => {
		for (const role of guild.roles) {
			await t.test(role.name, () => {
				addSnapshot({
					type: RequestType.AddRoleSnapshot,
					role,
					guildID: guild.id,
					timing: guildSnapshotTiming,
				});
			});
		}
	});
	await t.test("adding guild member snapshots works", async (t) => {
		for (const entry of guildMembers) {
			await t.test(entry.options, () => {
				addSnapshot({
					type: RequestType.AddGuildMemberSnapshot,
					member: entry.data,
					timing: guildSnapshotTiming,
					guildID: guild.id,
				});
			});
		}
	});
	await t.test("adding channel snapshots works", async (t) => {
		for (const channel of guild.channels) {
			await t.test(channel.name, () => {
				addSnapshot({
					type: RequestType.AddChannelSnapshot,
					channel: Object.assign(channel, { guild_id: guild.id }),
					timing: guildSnapshotTiming,
				});
			});
		}
	});
	await t.test("adding thread snapshots works", async (t) => {
		for (const thread of guild.threads) {
			await t.test(thread.name, () => {
				addSnapshot({
					type: RequestType.AddThreadSnapshot,
					thread: Object.assign(thread, { guild_id: guild.id }),
					timing: guildSnapshotTiming,
				});
			});
		}
	});
	await t.test("adding message snapshots works", async (t) => {
		for (const entry of messages) {
			await t.test(entry.options, () => {
				addSnapshot({
					type: RequestType.AddMessageSnapshot,
					message: entry.data,
					timing: guildSnapshotTiming,
					timestamp: guildSnapshotTiming.timestamp,
				});
			});
		}
	});
});

function stripGuild(guild: Partial<GatewayGuildCreateDispatchPayload["d"]>) {
	delete guild.emojis;
	delete guild.roles;

	// eslint-disable-next-line @typescript-eslint/no-deprecated
	delete guild.nsfw;
	delete guild.application_id;
	delete guild.features;
	delete guild.incidents_data;
	// eslint-disable-next-line @typescript-eslint/no-deprecated
	delete guild.region;
	delete guild.safety_alerts_channel_id;
	delete guild.stickers;
	guild.widget_enabled ??= false;

	// GUILD_CREATE dispatch fields
	delete guild.joined_at;
	delete guild.large;
	delete guild.unavailable;
	delete guild.member_count;
	delete guild.voice_states;
	delete guild.members;
	delete guild.channels;
	delete guild.threads;
	delete guild.presences;
	delete guild.stage_instances;
	delete guild.guild_scheduled_events;
	delete guild.soundboard_sounds;

	// Undocumented fields
	delete guild.moderator_reporting;
	delete guild.activity_instances;
	delete guild.hub_type;
	delete guild.latest_onboarding_question_id;
	delete guild.premium_features;
	delete guild.owner_configured_content_level;
	delete guild.embedded_activities;
	delete guild.lazy;
	delete guild.application_command_counts;
	delete guild.home_header;
	delete guild.version;
	delete guild.inventory_settings;

	return guild;
}
function stripGuildMember(member: Partial<GuildMember>) {
	member.joined_at = new Date(member.joined_at!).toISOString();
	if (member.premium_since != null) {
		member.premium_since = new Date(member.premium_since).toISOString();
	}

	stripUser(member.user!);

	return member;
}
function stripUser(user: Partial<User>) {
	user.bot ??= false;
	user.system ??= false;

	delete user.accent_color;
	delete user.banner;
	delete user.banner_color;
	if (user.flags == null) {
		user.flags = user.public_flags!;
	} else if (user.flags !== user.public_flags) {
		throw new Error("The member flags are not equal to the public flags");
	}
	delete user.display_name;

	return user;
}
function stripMessage(message: Partial<Message>) {
	message.timestamp = new Date(message.timestamp!).toISOString();
	if (message.edited_timestamp != null) {
		message.edited_timestamp = new Date(message.edited_timestamp).toISOString();
	}

	message.pinned = false;

	delete message.position;
	delete message.thread;

	delete message.resolved;
	delete message.interaction_metadata?.authorizing_integration_owners;
	delete message.interaction_metadata?.triggering_interaction_metadata;
	if (message.interaction_metadata?.user != null) {
		stripUser(message.interaction_metadata.user);
	}
	if (message.interaction_metadata?.target_user != null) {
		stripUser(message.interaction_metadata.target_user);
	}
	delete message.activity_instance;

	stripUser(message.author!);
	for (const user of message.mentions ?? []) {
		stripUser(user);
	}
	if (message.referenced_message != null) {
		stripMessage(message.referenced_message);
	}
	if (message.interaction != null) {
		stripUser(message.interaction.user);

		delete message.webhook_id;
	}

	for (const attachment of message.attachments!) {
		attachment.ephemeral ??= false;
		delete (attachment as Partial<Attachment>).proxy_url;
		delete (attachment as Partial<Attachment>).url;
		delete attachment.content_scan_version;
		delete attachment.placeholder_version;
		delete attachment.placeholder;
	}

	return message;
}
for (const user of users) {
	stripUser(user);
}
for (const { data: message } of messages) {
	stripMessage(message);
}
for (const channel of guild.channels) {
	// Properties which can be computed from other data in the database
	delete channel.last_message_id;
	delete channel.last_pin_timestamp;

	// Abandoned features
	delete channel.icon_emoji;
	delete channel.theme_color;

	// Experimental features
	delete channel.template;
	for (const tag of channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia ? channel.available_tags : []) {
		delete tag.color;
	}

	// Other undocumented fields
	delete channel.version;
	delete channel.status;
}
for (const thread of guild.threads) {
	delete thread.guild_id;

	delete thread.last_message_id;
	delete thread.total_message_sent;
	delete thread.member_count;
	delete thread.message_count;

	thread.thread_metadata.archive_timestamp = new Date(thread.thread_metadata.archive_timestamp).toISOString();
	if (thread.thread_metadata.create_timestamp != null) {
		thread.thread_metadata.create_timestamp = new Date(thread.thread_metadata.create_timestamp).toISOString();
	}
}
for (const role of guild.roles) {
	// Deprecated
	delete (role as any).color;

	delete role.version;
}
for (const emoji of guild.emojis) {
	delete emoji.available;

	delete emoji.version;
}


async function compareLatestSnapshots<Snapshot, Entry>(
	t: TestContext,
	snapshots: Snapshot[],
	entries: Iterable<Entry>,
	callback: (original: Entry, snapshots: Snapshot[], t: TestContext) => Promise<{ expectedObject: unknown; snapshot: Snapshot }>,
	testOptionsCallback: (original: Entry) => { name: string; skip?: boolean | string },
) {
	let i = 0;
	for (const entry of entries) {
		const testOptions = testOptionsCallback(entry);
		await t.test(testOptions.name, testOptions, async (t) => {
			const { expectedObject, snapshot } = await callback(entry, snapshots, t);
			assertEqual({
				expected: {
					timing: guildSnapshotTiming,
					deletedTiming: null,
					data: expectedObject,
				},
				actual: snapshot,
			});
		});
		i++;
	}
	await t.test("no missing or extra snapshots", () => {
		assert.equal(snapshots.length, i);
	});
}

await test("latest snapshots match", async (t) => {
	await Promise.all([
		t.test("latest guild snapshots match", (t) => compareLatestSnapshots(
			t,
			[...request({
				type: RequestType.GetGuilds,
			} satisfies GetGuildsRequest)],
			[guild],
			async (original, snapshots) => {
				const snapshot = snapshots.find(s => s.data.id === original.id);
				assert(snapshot !== undefined, "guild wasn't archived");
				stripGuild(snapshot.data);
				return { expectedObject: stripGuild(structuredClone(original)), snapshot };
			},
			_ => ({ name: "community server" }),
		)),
		t.test("latest member snapshots match", (t) => compareLatestSnapshots(
			t,
			[...request({
				type: RequestType.GetGuildMembers,
				guildID: guild.id,
			} satisfies GetGuildMembersRequest)],
			guildMembers,
			async (original, snapshots) => {
				const snapshot = snapshots.find(s => s.data.user.id === original.data.user.id);
				assert(snapshot !== undefined, "guild member wasn't archived");
				return { expectedObject: stripGuildMember(structuredClone(original.data)), snapshot };
			},
			entry => entry.options,
		)),
		t.test("latest channel snapshots match", (t) => compareLatestSnapshots(
			t,
			[...request({
				type: RequestType.GetChannels,
				guildID: guild.id,
			} satisfies GetChannelsRequest)],
			guild.channels,
			async (channel, snapshots, t) => {
				const snapshot = snapshots.find(s => s.data.id === channel.id);
				assert(snapshot !== undefined, "channel wasn't archived");
				if (channel.available_tags != null) {
					await t.test("latest forum tags snapshots match", (t) => compareLatestSnapshots(
						t,
						[...request({
							type: RequestType.GetForumTags,
							channelID: channel.id,
						} satisfies GetForumTagsRequest)],
						channel.available_tags as Iterable<unknown>,
						async (tag: any, snapshots) => {
							const snapshot = snapshots.find(s => s.data.id === tag.id);
							assert(snapshot !== undefined, "forum tag wasn't archived");
							return { expectedObject: tag, snapshot };
						},
						tag => ({ name: tag.name }),
					));

					channel = structuredClone(channel);
					delete channel.available_tags;
				}
				return { expectedObject: channel, snapshot };
			},
			channel => ({ name: channel.name }),
		)),
		t.test("latest thread snapshots match", (t) => compareLatestSnapshots(
			t,
			[...request({
				type: RequestType.GetThreads,
				parentID: "1367557310872031334",
			} satisfies GetThreadsRequest)],
			guild.threads,
			async (original, snapshots) => {
				const snapshot = snapshots.find(s => s.data.id === original.id);
				assert(snapshot !== undefined, "thread wasn't archived");
				return { expectedObject: original, snapshot };
			},
			thread => ({ name: thread.name }),
		)),
		t.test("latest message snapshots match", async (t) => {
			const channelsWithMessages: string[] = [...new Set(messages.map(entry => entry.data.channel_id))];
			await compareLatestSnapshots(
				t,
				channelsWithMessages
					.map(channelID => [...request({
						type: RequestType.GetMessages,
						channelID,
					} satisfies GetMessagesRequest)])
					.flat(),
				messages,
				async (original, snapshots) => {
					const snapshot = snapshots.find(s => s.data.id === original.data.id);
					assert(snapshot !== undefined, "message wasn't archived");
					stripMessage(snapshot.data);
					return { expectedObject: original.data, snapshot };
				},
				entry => entry.options,
			);
		}),
		t.test("latest role snapshots match", (t) => compareLatestSnapshots(
			t,
			[...request({
				type: RequestType.GetRoles,
				guildID: guild.id,
			} satisfies GetRolesRequest)],
			guild.roles,
			async (original, snapshots) => {
				const snapshot = snapshots.find(s => s.data.id === original.id);
				assert(snapshot !== undefined, "role wasn't archived");
				return { expectedObject: original, snapshot };
			},
			role => ({ name: role.name }),
		)),
		t.test("latest emoji snapshots match", (t) => compareLatestSnapshots(
			t,
			[...request({
				type: RequestType.GetGuildEmojis,
				guildID: guild.id,
			} satisfies GetGuildEmojisRequest)],
			guild.emojis,
			async (original, snapshots) => {
				const snapshot = snapshots.find(s => s.data.id === original.id);
				assert(snapshot !== undefined, "emoji wasn't archived");
				return {
					expectedObject: original,
					snapshot,
				};
			},
			emoji => ({ name: emoji.name }),
		)),
		t.test("emoji uploaders are missing", () => {
			assert.equal(
				request({
					type: RequestType.CheckForMissingEmojiUploaders,
					guildID: guild.id,
				}),
				true,
			);
		}),
	]);
});

request({
	type: RequestType.UpdateEmojiUploaders,
	emojis: [
		{
			id: "1367564352982356130",
			user__id: users[0].id,
		},
		{
			id: "1367564374880944139",
			user__id: users[0].id,
		},
	],
});

await Promise.all([
	test("emojis have uploaders", (t) => compareLatestSnapshots(
		t,
		[...request({
			type: RequestType.GetGuildEmojis,
			guildID: guild.id,
		} satisfies GetGuildEmojisRequest)],
		guild.emojis,
		async (original, snapshots) => {
			const snapshot = snapshots.find(s => s.data.id === original.id);
			assert(snapshot !== undefined, "emoji wasn't archived");
			return {
				expectedObject: Object.assign(Object.assign({}, original), { user: users[0] }),
				snapshot,
			};
		},
		emoji => ({ name: emoji.name }),
	)),
	test("emoji uploaders are not missing", () => {
		assert.equal(
			request({
				type: RequestType.CheckForMissingEmojiUploaders,
				guildID: guild.id,
			}),
			false,
		);
	}),
]);


await test("previous message snapshots match", async (t) => {
	for (const entry of messageEdits) {
		assert.equal(request({
			type: RequestType.AddMessageSnapshot,
			message: entry.data,
			timing: {
				timestamp: new Date(entry.data.edited_timestamp!).getTime(),
				realtime: true,
			},
			timestamp: entry.timestamp,
		}), AddSnapshotResult.AddedAnotherSnapshot);

		stripMessage(entry.data);
	}

	await t.test("oldest snapshot", () => {
		const id = messageEdits[0].data.id;
		const entry = messages.find(e => e.data.id === id)!;
		const messageCreationTimestamp = Number(snowflakeToTimestamp(BigInt(id)));
		const snapshot = [...request({
			type: RequestType.GetMessages,
			channelID: "1367557310872031334",
			timestamp: messageCreationTimestamp,
		} satisfies GetMessagesRequest)].find(e => e.data.id === id);
		assertEqual({
			expected: {
				timing: guildSnapshotTiming,
				deletedTiming: null,
				data: entry.data,
			},
			actual: snapshot,
		});
	});

	for (const entry of messageEdits) {
		const snapshot = [...request({
			type: RequestType.GetMessages,
			channelID: "1367557310872031334",
			timestamp: entry.timestamp,
		} satisfies GetMessagesRequest)].find(m => m.data.id === entry.data.id);
		const testOptions = entry.options;
		await t.test(testOptions.name, testOptions, () => {
			assertEqual({
				expected: {
					timing: {
						timestamp: new Date(entry.data.edited_timestamp!).getTime(),
						realtime: true,
					},
					deletedTiming: null,
					data: entry.data,
				},
				actual: snapshot,
			});
		});
	}
});

await test("no messages have been marked as deleted", () => {
	assert.equal(
		[...request({
			type: RequestType.GetMessages,
			channelID: "1367557310872031334",
		} satisfies GetMessagesRequest)]
			.filter(snapshot => snapshot.deletedTiming != null)
			.length,
		0,
	);
});

await test("messages can be marked as deleted", () => {
	const deletedEntries = messages
		.filter((entry): entry is MessageEntry & { deletedTiming: Timing } => entry.deletedTiming != null);
	for (const entry of deletedEntries) {
		request({
			type: RequestType.MarkMessageAsDeleted,
			timing: entry.deletedTiming,
			id: entry.data.id,
		} satisfies MarkMessageAsDeletedRequest);
	}
	for (const snapshot of request({
		type: RequestType.GetMessages,
		channelID: "1367557310872031334",
	} satisfies GetMessagesRequest)) {
		assert.deepEqual(
			snapshot.deletedTiming,
			deletedEntries.find(entry => entry.data.id === snapshot.data.id)?.deletedTiming ?? null,
		);
	}
});

await test("message references are stored correctly", async (t) => {
	async function testMessageReference(messageID: string, refChannelID: bigint | null, refGuildID: bigint | null) {
		const entry = messages.find(e => e.data.id === messageID)!;
		await t.test(entry.options, () => {
			const message = entry.data;
			const data = [...requestHandler({
				type: RequestType.Execute,
				sql: `SELECT message_reference__channel_id, message_reference__guild_id FROM latest_message_snapshots WHERE id = ${message.id}`,
			})][0];
			if (refChannelID != null) assert.equal(data.message_reference__channel_id, refChannelID);
			if (refGuildID != null) assert.equal(data.message_reference__guild_id, refGuildID);
		});
	}

	// Reply: references a message in the same channel
	await testMessageReference("1406771857369206825", 0n, 0n);
	// Reply in thread: references a message in the same thread
	await testMessageReference("1426669514359181445", 0n, 0n);
	// Thread starter message: references a message in the parent channel
	await testMessageReference("1412186599952875694", 1n, 0n);
	// Pin announcement: references a message in the same channel and doesn't include the guild ID for some reason
	await testMessageReference("1367567786964160653", 0n, null);
	// Thread creation announcement: references the new thread
	await testMessageReference("1407105149037576367", null, 0n);
	// Forwarded message from the same channel: references a message in the same channel
	await testMessageReference("1407105614689206466", 0n, 0n);
	// Forwarded message from a different channel in the same server
	await testMessageReference("1428017174668378284", null, 0n);
	// Forwarded message from a different server
	await testMessageReference("1428017938564255818", null, null);
	// Poll result announcement: references the same channel and doesn't include the guild ID for some reason
	await testMessageReference("1412043486085120161", 0n, null);
	// Follow add announcement: references the followed channel (in this case, from the same server)
	await testMessageReference("1426676117129138337", null, 0n);
	// Crossposted message: references the original message (in this case, from the same server)
	await testMessageReference("1426688355608956949", null, 0n);
});

await test("archiving members works", async () => {
	await test("guild member syncs work", () => {
		const syncTimestamp = new Date("2025-09-17T00:00:00Z").getTime();

		request({
			type: RequestType.SyncGuildMembers,
			guildID: BigInt(guild.id),
			userIDs: new Set([BigInt(guildMembers[2].data.user.id), BigInt(guildMembers[3].data.user.id)]),
			timing: {
				timestamp: syncTimestamp,
				realtime: false,
			},
		} satisfies SyncGuildMembersRequest);

		const snapshots = [...request({
			type: RequestType.GetGuildMembers,
			guildID: guild.id,
			timestamp: syncTimestamp,
		} satisfies GetGuildMembersRequest)];
		assert.equal(snapshots.length, guildMembers.length);
		for (const snapshot of snapshots) {
			assert.deepEqual(
				snapshot.deletedTiming,
				[guildMembers[2].data.user.id, guildMembers[3].data.user.id].includes(snapshot.data.user.id) ?
					null :
					{
						timestamp: syncTimestamp,
						realtime: false,
					},
			);
		}
	});

	function testMemberLeave(expectedResult: AddSnapshotResult) {
		const timing = {
			timestamp: new Date("2025-09-17T01:00:00Z").getTime(),
			realtime: true,
		};

		assert.equal(
			request({
				type: RequestType.AddGuildMemberLeave,
				guildID: guild.id,
				userID: guildMembers[2].data.user.id,
				timing,
			} satisfies AddGuildMemberLeaveRequest),
			expectedResult,
		);

		const snapshots = [...request({
			type: RequestType.GetGuildMembers,
			guildID: guild.id,
			timestamp: timing.timestamp,
		} satisfies GetGuildMembersRequest)];
		assert.equal(snapshots.length, guildMembers.length);
		assert.deepEqual(
			snapshots.find(s => s.data.user.id === guildMembers[2].data.user.id)!.deletedTiming,
			timing,
		);
	}
	await test("guild member leaves are saved", () => {
		testMemberLeave(AddSnapshotResult.AddedAnotherSnapshot);
	});
	await test("guild member leaves are idempotent", () => {
		testMemberLeave(AddSnapshotResult.SameAsLatest);
	});

	function testMemberJoin(expectedResult: AddSnapshotResult) {
		const timing = {
			timestamp: new Date("2025-09-17T02:00:00Z").getTime(),
			realtime: true,
		};
		const member = guildMembers[2].data;

		assert.equal(
			request({
				type: RequestType.AddGuildMemberSnapshot,
				guildID: guild.id,
				member,
				timing,
			} satisfies AddGuildMemberSnapshotRequest),
			expectedResult,
		);

		const snapshots = [...request({
			type: RequestType.GetGuildMembers,
			guildID: guild.id,
			timestamp: timing.timestamp,
		} satisfies GetGuildMembersRequest)];
		assert.equal(snapshots.length, guildMembers.length);
		assertEqual({
			actual: snapshots.find(s => s.data.user.id === guildMembers[2].data.user.id),
			expected: {
				timing,
				deletedTiming: null,
				data: stripGuildMember(structuredClone(member)),
			},
		});
	}
	await test("guild member joins are saved", () => {
		testMemberJoin(AddSnapshotResult.AddedAnotherSnapshot);
	});
	await test("guild member joins are idempotent", () => {
		testMemberJoin(AddSnapshotResult.SameAsLatest);
	});

	await test("guild member updates don't change the `deaf` and `mute` properties", () => {
		const timing = {
			timestamp: new Date("2025-09-17T03:00:00Z").getTime(),
			realtime: true,
		};

		const memberWithout: Omit<GuildMember, "deaf" | "mute"> = {
			flags: 0,
			joined_at: "2025-05-01T17:44:30.825000+00:00",
			nick: null,
			pending: false,
			roles: [],
			user: generateUser(),
		};
		const memberWith: GuildMemberWithOptionalVoiceFields = structuredClone(memberWithout);
		memberWith.deaf = true;
		memberWith.mute = false;
		memberWith.user = generateUser();

		function assertSnapshotsEqual(
			snapshot: IteratorResponseFor<GetGuildMembersRequest>,
			member: GuildMemberWithOptionalVoiceFields,
		) {
			assertEqual({
				actual: snapshot,
				expected: {
					timing,
					deletedTiming: null,
					data: stripGuildMember(structuredClone(member)),
				},
			});
		}
		function checkSnapshots() {
			const snapshots = [...request({
				type: RequestType.GetGuildMembers,
				guildID: guild.id,
				timestamp: timing.timestamp,
			} satisfies GetGuildMembersRequest)];
			assert.equal(snapshots.length, guildMembers.length + 2);

			const snapshotWithout = snapshots.find(s => s.data.user.id === memberWithout.user.id)!;
			const snapshotWith = snapshots.find(s => s.data.user.id === memberWith.user.id)!;
			assert.equal(snapshotWithout.deletedTiming, null);
			assert(!("deaf" in snapshotWithout.data));
			assert(!("mute" in snapshotWithout.data));
			assert.equal(snapshotWith.deletedTiming, null);
			assert.equal(snapshotWith.data.deaf, true);
			assert.equal(snapshotWith.data.mute, false);

			assertSnapshotsEqual(snapshotWithout, memberWithout);
			assertSnapshotsEqual(snapshotWith, memberWith);
		}


		for (const member of [memberWithout, memberWith]) {
			assert.equal(
				request({
					type: RequestType.AddGuildMemberSnapshot,
					guildID: guild.id,
					member,
					timing,
				} satisfies AddGuildMemberSnapshotRequest),
				AddSnapshotResult.AddedFirstSnapshot,
			);
		}

		checkSnapshots();


		timing.timestamp = new Date("2025-09-17T04:00:00Z").getTime();
		delete memberWith.deaf;
		delete memberWith.mute;
		memberWithout.nick = "updated";
		memberWith.nick = "updated";
		for (const member of [memberWithout, memberWith]) {
			assert.equal(
				request({
					type: RequestType.AddGuildMemberSnapshot,
					guildID: guild.id,
					member,
					timing,
				} satisfies AddGuildMemberSnapshotRequest),
				AddSnapshotResult.AddedAnotherSnapshot,
			);
		}

		memberWith.deaf = true;
		memberWith.mute = false;
		checkSnapshots();
	});

	await test("guild members with missing mandatory properties are rejected", () => {
		assert.throws(
			() => request({
				type: RequestType.AddGuildMemberSnapshot,
				guildID: guild.id,
				member: {
					// missing `flags`
					joined_at: "2025-05-01T17:44:30.825000+00:00",
					nick: null,
					pending: false,
					roles: [],
					user: guildMembers[0].data.user,
				} as any,
				timing: {
					timestamp: new Date("2025-09-17T04:00:00Z").getTime(),
					realtime: false,
				},
			} satisfies AddGuildMemberSnapshotRequest),
			TypeError,
		);
	});
});

async function testLastSyncedMessageID(t: TestContext, isThread: boolean) {
	const channelID = (isThread ? guild.threads : guild.channels)[0].id;
	const lastSyncedMessageID = 123456789n;

	await t.test("it's initially 0", () => {
		assert.equal(
			request({
				type: RequestType.GetLastSyncedMessageID,
				channelID,
				isThread,
			} satisfies GetLastSyncedMessageIDRequest),
			0n,
		);
	});
	await t.test("getting returns the last set value", () => {
		request({
			type: RequestType.SetLastSyncedMessageID,
			channelID,
			isThread,
			lastSyncedMessageID: lastSyncedMessageID,
		} satisfies SetLastSyncedMessageIDRequest);
		assert.equal(
			request({
				type: RequestType.GetLastSyncedMessageID,
				channelID,
				isThread,
			} satisfies GetLastSyncedMessageIDRequest),
			lastSyncedMessageID,
		);
	});
	await t.test("the get request returns `undefined` for unknown channels/threads", () => {
		assert.equal(
			request({
				type: RequestType.GetLastSyncedMessageID,
				channelID: "12345678",
				isThread,
			} satisfies GetLastSyncedMessageIDRequest),
			undefined,
		);
	});

	await t.test("can't be set to `null`", () => {
		assert.throws(
			() => {
				request({
					type: RequestType.SetLastSyncedMessageID,
					channelID,
					isThread,
					lastSyncedMessageID: null,
				} satisfies SetLastSyncedMessageIDRequest);
			},
		);
		assert.equal(
			request({
				type: RequestType.GetLastSyncedMessageID,
				channelID,
				isThread,
			} satisfies GetLastSyncedMessageIDRequest),
			lastSyncedMessageID,
		);
	});
}
await test("getting/setting the latest synced message ID works", async (t) => {
	await t.test("for channels", t => testLastSyncedMessageID(t, false));
	await t.test("for threads", t => testLastSyncedMessageID(t, true));
});

await test("archiving reactions works", async (t) => {
	const messageID = messages[0].data.id;
	const newUsers = [generateUser(), generateUser(), generateUser()];
	const unicodeEmoji: PartialEmoji = { id: null, name: "👨‍💻" };
	const guildEmoji: PartialEmoji = { id: guild.emojis[0].id, name: guild.emojis[0].name };
	const animatedGuildEmoji: PartialEmoji = { id: guild.emojis[1].id, name: guild.emojis[1].name, animated: true };

	await t.test("adding initial reactions works", () => {
		const timestamp = new Date("2025-10-05T00:00:00Z").getTime();
		requestHandler({
			type: RequestType.AddInitialReactions,
			timestamp,
			messageID,
			emoji: unicodeEmoji,
			reactionType: ReactionType.Normal,
			users: [newUsers[0]],
		} satisfies AddInitialReactionsRequest);
		requestHandler({
			type: RequestType.AddInitialReactions,
			timestamp,
			messageID,
			emoji: guildEmoji,
			reactionType: ReactionType.Burst,
			users: [newUsers[1]],
		} satisfies AddInitialReactionsRequest);
		requestHandler({
			type: RequestType.AddInitialReactions,
			timestamp,
			messageID,
			emoji: animatedGuildEmoji,
			reactionType: ReactionType.Normal,
			users: [newUsers[0], newUsers[1]],
		} satisfies AddInitialReactionsRequest);
	});

	await t.test("adding a new reaction from a message not in the database returns the expected value", () => {
		assert.equal(requestHandler({
			type: RequestType.AddReactionPlacement,
			messageID: "123456789",
			emoji: unicodeEmoji,
			reactionType: ReactionType.Normal,
			userID: newUsers[2].id,
			user: newUsers[2],
			timing: {
				timestamp: new Date("2025-10-05T01:00:00Z").getTime(),
				realtime: true,
			},
		}), AddReactionResult.MissingMessage);
	});
	await t.test("adding a new reaction from a user not in the database returns the expected value", () => {
		assert.equal(requestHandler({
			type: RequestType.AddReactionPlacement,
			messageID,
			emoji: unicodeEmoji,
			reactionType: ReactionType.Normal,
			userID: newUsers[2].id,
			timing: {
				timestamp: new Date("2025-10-05T01:00:00Z").getTime(),
				realtime: true,
			},
		}), AddReactionResult.MissingUser);
	});

	const addRequest0: AddReactionPlacementRequest = {
		type: RequestType.AddReactionPlacement,
		messageID,
		emoji: unicodeEmoji,
		reactionType: ReactionType.Normal,
		userID: newUsers[2].id,
		user: newUsers[2],
		timing: {
			timestamp: new Date("2025-10-05T01:00:00Z").getTime(),
			realtime: true,
		},
	};
	await t.test("adding a new reaction with the same emoji and type works", () => {
		assert.equal(requestHandler(addRequest0), AddReactionResult.AddedReaction);
	});
	await t.test("adding a new reaction with the same emoji and type is idempotent", () => {
		assert.equal(requestHandler(addRequest0), AddReactionResult.AlreadyExists);
	});

	const addRequest1: AddReactionPlacementRequest = {
		type: RequestType.AddReactionPlacement,
		messageID,
		emoji: unicodeEmoji,
		reactionType: ReactionType.Burst,
		userID: newUsers[2].id,
		timing: {
			timestamp: new Date("2025-10-05T02:00:00Z").getTime(),
			realtime: false,
		},
	};
	await t.test("adding a new reaction with the same emoji but a different type works", () => {
		assert.equal(requestHandler(addRequest1), AddReactionResult.AddedReaction);
	});
	await t.test("adding a new reaction with the same emoji but a different type is idempotent", () => {
		assert.equal(requestHandler(addRequest1), AddReactionResult.AlreadyExists);
	});

	const removeRequest: MarkReactionAsRemovedRequest = {
		type: RequestType.MarkReactionAsRemoved,
		messageID,
		emoji: unicodeEmoji,
		reactionType: ReactionType.Normal,
		userID: newUsers[0].id,
		timing: {
			timestamp: new Date("2025-10-05T03:00:00Z").getTime(),
			realtime: true,
		},
	};
	await t.test("removing a reaction works", () => {
		assert.equal(requestHandler(removeRequest), true);
	});
	await t.test("removing a reaction is idempotent", () => {
		assert.equal(requestHandler(removeRequest), false);
	});

	const addRequest2: AddReactionPlacementRequest = {
		type: RequestType.AddReactionPlacement,
		messageID,
		emoji: unicodeEmoji,
		reactionType: ReactionType.Normal,
		userID: newUsers[0].id,
		timing: {
			timestamp: new Date("2025-10-05T04:00:00Z").getTime(),
			realtime: true,
		},
	};
	await t.test("adding a previously removed reaction works", () => {
		assert.equal(requestHandler(addRequest2), AddReactionResult.AddedReaction);
	});
	await t.test("adding a previously removed reaction is idempotent", () => {
		assert.equal(requestHandler(addRequest2), AddReactionResult.AlreadyExists);
	});

	const removeEmojiRequest: MarkReactionAsRemovedBulkRequest = {
		type: RequestType.MarkReactionsAsRemovedBulk,
		messageID,
		emoji: unicodeEmoji,
		timing: {
			timestamp: new Date("2025-10-05T05:00:00Z").getTime(),
			realtime: true,
		},
	};
	await t.test("removing all reactions with a given emoji works", () => {
		assert.equal(requestHandler(removeEmojiRequest), 3);
	});
	await t.test("removing all reactions with a given emoji is idempotent", () => {
		assert.equal(requestHandler(removeEmojiRequest), 0);
	});

	const removeAllRequest: MarkReactionAsRemovedBulkRequest = {
		type: RequestType.MarkReactionsAsRemovedBulk,
		messageID,
		emoji: null,
		timing: {
			timestamp: new Date("2025-10-05T06:00:00Z").getTime(),
			realtime: false,
		},
	};
	await t.test("removing all reactions works", () => {
		assert.equal(requestHandler(removeAllRequest), 3);
	});
	await t.test("removing all reactions is idempotent", () => {
		assert.equal(requestHandler(removeAllRequest), 0);
	});

	await t.test("the reaction history is as expected", () => {
		for (const user of newUsers) {
			stripUser(user);
		}

		const history = [...requestHandler({
			type: RequestType.GetReactionHistory,
			messageID,
		} satisfies GetReactionHistoryRequest)];
		assert.equal(history.length, 7);

		function check(entry: IteratorResponseFor<GetReactionHistoryRequest>) {
			assert.deepEqual(
				history.find(e =>
					e.start.timestamp === entry.start.timestamp &&
					e.emoji.id === entry.emoji.id &&
					e.emoji.name === entry.emoji.name &&
					e.type === entry.type &&
					e.user.id === entry.user.id,
				),
				entry,
			);
		}
		check({
			start: { timestamp: new Date("2025-10-05T00:00:00Z").getTime(), realtime: false },
			end: { timestamp: new Date("2025-10-05T03:00:00Z").getTime(), realtime: true },
			emoji: unicodeEmoji,
			type: ReactionType.Normal,
			user: newUsers[0],
		});
		check({
			start: { timestamp: new Date("2025-10-05T00:00:00Z").getTime(), realtime: false },
			end: { timestamp: new Date("2025-10-05T06:00:00Z").getTime(), realtime: false },
			emoji: guildEmoji,
			type: ReactionType.Burst,
			user: newUsers[1],
		});
		check({
			start: { timestamp: new Date("2025-10-05T00:00:00Z").getTime(), realtime: false },
			end: { timestamp: new Date("2025-10-05T06:00:00Z").getTime(), realtime: false },
			emoji: animatedGuildEmoji,
			type: ReactionType.Normal,
			user: newUsers[0],
		});
		check({
			start: { timestamp: new Date("2025-10-05T00:00:00Z").getTime(), realtime: false },
			end: { timestamp: new Date("2025-10-05T06:00:00Z").getTime(), realtime: false },
			emoji: animatedGuildEmoji,
			type: ReactionType.Normal,
			user: newUsers[1],
		});
		check({
			start: { timestamp: new Date("2025-10-05T01:00:00Z").getTime(), realtime: true },
			end: { timestamp: new Date("2025-10-05T05:00:00Z").getTime(), realtime: true },
			emoji: unicodeEmoji,
			type: ReactionType.Normal,
			user: newUsers[2],
		});
		check({
			start: { timestamp: new Date("2025-10-05T02:00:00Z").getTime(), realtime: false },
			end: { timestamp: new Date("2025-10-05T05:00:00Z").getTime(), realtime: true },
			emoji: unicodeEmoji,
			type: ReactionType.Burst,
			user: newUsers[2],
		});
		check({
			start: { timestamp: new Date("2025-10-05T04:00:00Z").getTime(), realtime: true },
			end: { timestamp: new Date("2025-10-05T05:00:00Z").getTime(), realtime: true },
			emoji: unicodeEmoji,
			type: ReactionType.Normal,
			user: newUsers[0],
		});
	});
});

await test("snapshots are compared correctly", async (t) => {
	let timestamp = new Date("2025-10-23T00:00:00Z").getTime();

	await t.test("message snapshots are compared correctly", async (t) => {
		const channelID = "1367557310872031334";
		function testMessageComparison(same: boolean, oldObject: Message, newObject: Message) {
			assert.equal(
				request({
					type: RequestType.AddMessageSnapshot,
					timing: { timestamp, realtime: true },
					timestamp,
					message: oldObject,
				} satisfies AddMessageSnapshotRequest),
				AddSnapshotResult.AddedFirstSnapshot,
			);
			assert.equal(
				request({
					type: RequestType.AddMessageSnapshot,
					timing: { timestamp: timestamp + 1, realtime: true },
					timestamp,
					message: newObject,
				} satisfies AddMessageSnapshotRequest),
				same ?
					AddSnapshotResult.SameAsLatest :
					AddSnapshotResult.AddedAnotherSnapshot,
			);

			let snapshot: IteratorResponseFor<GetMessagesRequest> | undefined;
			for (const s of request({
				type: RequestType.GetMessages,
				timestamp: timestamp + 1,
				channelID,
			} satisfies GetMessagesRequest)) {
				if (s.data.id === oldObject.id) {
					snapshot = s;
					break;
				}
			}
			assert(snapshot !== undefined);
			assert(snapshot.timing !== null);
			assert.equal(snapshot.timing.timestamp, same ? timestamp : (timestamp + 1));
		}

		await t.test("the same message snapshot is not recorded", () => {
			const message = generateMessage();
			testMessageComparison(true, message, message);
		});
		await t.test("a different message snapshot is recorded", () => {
			const oldMessage = generateMessage();
			const newMessage = structuredClone(oldMessage);
			newMessage.content = "hi";
			testMessageComparison(false, oldMessage, newMessage);
		});
		await t.test("a message snapshot with a new unknown property is recorded", () => {
			const oldMessage: RecursiveExtension<Message> = generateMessage();
			const newMessage = structuredClone(oldMessage);
			newMessage.unknown = null;
			testMessageComparison(false, oldMessage, newMessage);
		});
		await t.test("a message snapshot with a different unknown property order is not recorded", () => {
			const oldMessage: RecursiveExtension<Message> = generateMessage();
			const newMessage = structuredClone(oldMessage);
			oldMessage.unknown0 = null;
			oldMessage.unknown1 = null;
			newMessage.unknown1 = null;
			newMessage.unknown0 = null;
			testMessageComparison(true, oldMessage, newMessage);
		});
		await t.test("a message snapshot with a different edited timestamp is recorded", () => {
			const oldMessage = generateMessage();
			const newMessage = structuredClone(oldMessage);
			oldMessage.edited_timestamp = "2025-11-13T00:00:00.000000+00:00";
			newMessage.edited_timestamp = "2025-11-13T01:00:00.000000+00:00";
			testMessageComparison(false, oldMessage, newMessage);
		});
		await t.test("a message snapshot with different attachment URLs in the embeds is not recorded", () => {
			const id = generateSnowflake();
			// The message content and embed objects below were obtained directly from Discord and are from the same unedited message.
			const oldMessage: Message = {
				type: 0,
				content: "Embedded video from attachment\nhttps://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [
					{
						type: "video",
						url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
						video: {
							url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
							proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
							width: 320,
							height: 240,
							content_type: "video/mp4",
							placeholder: "3/cNLYZ1cIB3Z3dHaHiId4AouK+I",
							placeholder_version: 1,
							flags: 0,
						},
						content_scan_version: 2,
					},
				],
				timestamp: snowflakeToIsoTimestamp(id),
				edited_timestamp: null,
				flags: 0,
				components: [],
				id,
				channel_id: "1367557310872031334",
				author: users[0],
				pinned: false,
				mention_everyone: false,
				tts: false,
			};
			const newMessage: Message = {
				type: 0,
				content: "Embedded video from attachment\nhttps://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [
					{
						type: "video",
						url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6916ebaa&is=69159a2a&hm=6d68576998e80838a8aa8ff1bbd888034d948ec9d9a054893744a1b55b49539d&",
						video: {
							url: "https://cdn.discordapp.com/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6917946a&is=691642ea&hm=90929e984d3d244974b1a080f39671fff7baf513b26e2a6be772932c50ffee61&",
							proxy_url: "https://media.discordapp.net/attachments/1367557310872031334/1408914540024037447/video.mp4?ex=6917946a&is=691642ea&hm=90929e984d3d244974b1a080f39671fff7baf513b26e2a6be772932c50ffee61&",
							width: 320,
							height: 240,
							content_type: "video/mp4",
							placeholder: "3/cNLYZ1cIB3Z3dHaHiId4AouK+I",
							placeholder_version: 1,
							flags: 0,
						},
						content_scan_version: 2,
					},
				],
				timestamp: snowflakeToIsoTimestamp(id),
				edited_timestamp: null,
				flags: 0,
				components: [],
				id,
				channel_id: "1367557310872031334",
				author: users[0],
				pinned: false,
				mention_everyone: false,
				tts: false,
			};
			testMessageComparison(true, oldMessage, newMessage);
		});
	});

	await t.test("guild member snapshots are compared correctly", async (t) => {
		function testGuildMemberComparison(same: boolean, guildID: string, oldObject: GuildMemberWithOptionalVoiceFields, newObject: GuildMemberWithOptionalVoiceFields) {
			assert.equal(
				request({
					type: RequestType.AddGuildMemberSnapshot,
					timing: { timestamp, realtime: true },
					guildID,
					member: oldObject,
				} satisfies AddGuildMemberSnapshotRequest),
				AddSnapshotResult.AddedFirstSnapshot,
			);
			assert.equal(
				request({
					type: RequestType.AddGuildMemberSnapshot,
					timing: { timestamp: timestamp + 1, realtime: true },
					guildID,
					member: newObject,
				} satisfies AddGuildMemberSnapshotRequest),
				same ?
					AddSnapshotResult.SameAsLatest :
					AddSnapshotResult.AddedAnotherSnapshot,
			);

			let snapshot: IteratorResponseFor<GetGuildMembersRequest> | undefined;
			for (const s of request({
				type: RequestType.GetGuildMembers,
				timestamp: timestamp + 1,
				guildID,
			} satisfies GetGuildMembersRequest)) {
				if (s.data.user.id === oldObject.user.id) {
					snapshot = s;
					break;
				}
			}
			assert(snapshot !== undefined);
			assert.equal(snapshot.timing.timestamp, same ? timestamp : (timestamp + 1));
			timestamp += 2;
		}

		await t.test("the same member snapshot is not recorded", () => {
			const member = generateGuildMember();
			testGuildMemberComparison(true, guild.id, member, member);
		});
		await t.test("a different member snapshot is recorded", () => {
			const oldMember = generateGuildMember();
			const newMember = structuredClone(oldMember);
			newMember.flags = 1;
			testGuildMemberComparison(false, guild.id, oldMember, newMember);
		});
		await t.test("a member snapshot with different a `deaf` value is recorded", () => {
			const oldMember: GuildMember = generateGuildMember();
			const newMember = structuredClone(oldMember);
			newMember.deaf = true;
			testGuildMemberComparison(false, guild.id, oldMember, newMember);
		});
		await t.test("a member snapshot with a `deaf` value which was previously unknown is recorded", () => {
			const oldMember: GuildMemberWithOptionalVoiceFields = generateGuildMember();
			delete oldMember.deaf;
			const newMember = structuredClone(oldMember);
			newMember.deaf = true;
			testGuildMemberComparison(false, guild.id, oldMember, newMember);
		});
		await t.test("a member snapshot with an unknown `deaf` value which was previously known is not recorded", () => {
			const oldMember: GuildMemberWithOptionalVoiceFields = generateGuildMember();
			const newMember = structuredClone(oldMember);
			delete newMember.deaf;
			testGuildMemberComparison(true, guild.id, oldMember, newMember);
		});
		await t.test("a member snapshot with a new unknown property is recorded", () => {
			const oldMember: RecursiveExtension<GuildMember> = generateGuildMember();
			const newMember = structuredClone(oldMember);
			newMember.unknown = null;
			testGuildMemberComparison(false, guild.id, oldMember, newMember);
		});
		await t.test("a member snapshot with a different unknown property order is not recorded", () => {
			const oldMember: RecursiveExtension<GuildMember> = generateGuildMember();
			const newMember = structuredClone(oldMember);
			oldMember.unknown0 = null;
			oldMember.unknown1 = null;
			newMember.unknown1 = null;
			newMember.unknown0 = null;
			testGuildMemberComparison(true, guild.id, oldMember, newMember);
		});
	});
});

await test("snapshots are verified correctly", async (t) => {
	let timestamp = new Date("2025-10-28T00:00:00Z").getTime();

	await t.test("attempting to modify an immutable field of a message throws", () => {
		const oldMessage = generateMessage();
		assert.equal(request({
			type: RequestType.AddMessageSnapshot,
			timing: { timestamp, realtime: false },
			timestamp,
			message: oldMessage,
		}), AddSnapshotResult.AddedFirstSnapshot);
		timestamp++;

		const newMessage = structuredClone(oldMessage);
		newMessage.tts = true;
		assert.throws(() => {
			request({
				type: RequestType.AddMessageSnapshot,
				timing: { timestamp, realtime: false },
				timestamp,
				message: newMessage,
			});
		}, new Error("The field \"tts\" of a \"message\" object, assumed to be immutable, has a different value than the one stored in the database."));
		timestamp++;
	});

	await t.test("attempting to modify an immutable field of a guild emoji throws", () => {
		const oldEmoji: CustomEmoji = {
			id: generateSnowflake(),
			name: "fake",
		};
		assert.equal(request({
			type: RequestType.AddGuildEmojiSnapshot,
			timing: { timestamp, realtime: false },
			emoji: oldEmoji,
			guildID: guild.id,
		}), AddSnapshotResult.AddedFirstSnapshot);
		timestamp++;

		const newEmoji = structuredClone(oldEmoji);
		newEmoji.animated = true;
		assert.throws(() => {
			request({
				type: RequestType.AddGuildEmojiSnapshot,
				timing: { timestamp, realtime: false },
				emoji: newEmoji,
				guildID: guild.id,
			});
		}, new Error("The field \"animated\" of a \"guild_emoji\" object, assumed to be immutable, has a different value than the one stored in the database."));
		timestamp++;
	});

	await t.test("attempting to modify a guild emoji's uploader's ID throws", () => {
		const oldEmoji: CustomEmoji = {
			id: generateSnowflake(),
			name: "fake",
			user: users[0],
		};
		assert.equal(request({
			type: RequestType.AddGuildEmojiSnapshot,
			timing: { timestamp, realtime: false },
			emoji: oldEmoji,
			guildID: guild.id,
		}), AddSnapshotResult.AddedFirstSnapshot);
		timestamp++;

		const newEmoji = structuredClone(oldEmoji);
		newEmoji.user = users[1];
		assert.throws(() => {
			request({
				type: RequestType.AddGuildEmojiSnapshot,
				timing: { timestamp, realtime: false },
				emoji: newEmoji,
				guildID: guild.id,
			});
		}, new Error("The ID of the guild emoji's uploader is different from the one stored in the database."));
		timestamp++;
	});

	await t.test("archiving a snapshot of a guild emoji with the uploader ID already set works", () => {
		const emojiWithUploader: CustomEmoji = {
			id: generateSnowflake(),
			name: "fake",
			user: users[0],
		};
		assert.equal(request({
			type: RequestType.AddGuildEmojiSnapshot,
			timing: { timestamp, realtime: false },
			emoji: emojiWithUploader,
			guildID: guild.id,
		}), AddSnapshotResult.AddedFirstSnapshot);
		timestamp++;

		const emojiWithoutUploader0 = structuredClone(emojiWithUploader);
		delete emojiWithoutUploader0.user;
		assert.equal(request({
			type: RequestType.AddGuildEmojiSnapshot,
			timing: { timestamp, realtime: false },
			emoji: emojiWithoutUploader0,
			guildID: guild.id,
		}), AddSnapshotResult.SameAsLatest);
		timestamp++;

		const emojiWithoutUploader1 = structuredClone(emojiWithUploader);
		delete emojiWithoutUploader1.user;
		emojiWithoutUploader1.name = "new_name";
		assert.equal(request({
			type: RequestType.AddGuildEmojiSnapshot,
			timing: { timestamp, realtime: false },
			emoji: emojiWithoutUploader1,
			guildID: guild.id,
		}), AddSnapshotResult.AddedAnotherSnapshot);
		timestamp++;
	});
});

requestHandler({
	type: RequestType.Close,
});
