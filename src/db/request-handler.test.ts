import test, { TestContext } from "node:test";
import assert from "node:assert/strict";
import { getRequestHandler, RequestHandler } from "./request-handler.js";
import { GetChannelsRequest, GetForumTagsRequest, GetGuildEmojisRequest, GetGuildsRequest, GetMessagesRequest, GetRolesRequest, GetThreadsRequest, IteratorResponseFor, MarkMessageAsDeletedRequest, RequestType, Timing } from "./types.js";
import { Attachment, ChannelType, GatewayGuildCreateDispatchPayload, Message, PartialUser, User } from "../discord-api/types.js";
import { parseArgs } from "node:util";
import { unlinkSync } from "node:fs";
import { Logger } from "../util/log.js";
import { snowflakeToTimestamp } from "../discord-api/snowflake.js";

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

const users: RecursiveExtension<PartialUser>[] = [
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
		options: { name: "forwarded message" },
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

request({
	type: RequestType.AddGuildSnapshot,
	guild: guild,
	timing: guildSnapshotTiming,
});

for (const emoji of guild.emojis) {
	request({
		type: RequestType.AddGuildEmojiSnapshot,
		emoji,
		guildID: guild.id,
		timing: guildSnapshotTiming,
	});
}

for (const role of guild.roles) {
	request({
		type: RequestType.AddRoleSnapshot,
		role,
		guildID: guild.id,
		timing: guildSnapshotTiming,
	});
}

for (const channel of guild.channels) {
	request({
		type: RequestType.AddChannelSnapshot,
		channel: Object.assign(channel, { guild_id: guild.id }),
		timing: guildSnapshotTiming,
	});
}
for (const thread of guild.threads) {
	request({
		type: RequestType.AddThreadSnapshot,
		thread: Object.assign(thread, { guild_id: guild.id }),
		timing: guildSnapshotTiming,
	});
}

for (const entry of messages) {
	request({
		type: RequestType.AddMessageSnapshot,
		message: entry.data,
		timestamp: guildSnapshotTiming.timestamp,
	});
}

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
function stripUser(user: Partial<User>) {
	user.bot ??= false;
	user.system ??= false;
	delete user.collectibles;

	// TODO for user profile
	delete user.accent_color;
	delete user.avatar_decoration_data;
	delete user.banner;
	delete user.banner_color;
	delete user.display_name_styles;

	// TODO for clan support
	// eslint-disable-next-line @typescript-eslint/no-deprecated
	delete user.clan;
	delete user.primary_guild;

	return user;
}
function stripMessage(message: Partial<Message>) {
	message.timestamp = new Date(message.timestamp!).toISOString();
	if (message.edited_timestamp != null) {
		message.edited_timestamp = new Date(message.edited_timestamp).toISOString();
	}

	message.pinned = false;
	message.mentions = [];
	message.mention_roles = [];
	message.mention_everyone = false;


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


async function compareLatestSnapshots<R extends GetGuildsRequest | GetChannelsRequest | GetThreadsRequest | GetMessagesRequest | GetRolesRequest | GetForumTagsRequest | GetGuildEmojisRequest, T>(
	t: TestContext,
	req: R,
	entries: Iterable<T>,
	callback: (original: T, snapshots: IteratorResponseFor<R>[], t: TestContext) => Promise<{ expectedObject: unknown; snapshot: IteratorResponseFor<R> }>,
	testOptionsCallback: (original: T) => { name: string; skip?: boolean | string },
) {
	const snapshots = [...request(req)];
	let i = 0;
	for (const entry of entries) {
		const testOptions = testOptionsCallback(entry);
		await t.test(testOptions.name, testOptions, async (t) => {
			const { expectedObject, snapshot } = await callback(entry, snapshots, t);
			assertEqual({
				expected: {
					timing: req.type === RequestType.GetMessages ? null : guildSnapshotTiming,
					deletedTiming: null,
					data: expectedObject,
				},
				actual: {
					...snapshot,
					...(req.type === RequestType.GetMessages ? { timing: null } : {}),
				},
			});
		});
		i++;
	}
	await t.test("no missing or extra snapshots", () => {
		assert.equal(snapshots.length, i);
	});
}

await Promise.all([
	test("latest guild snapshots match", (t) => compareLatestSnapshots(
		t,
		{
			type: RequestType.GetGuilds,
		} satisfies GetGuildsRequest,
		[guild],
		async (original, snapshots) => {
			const snapshot = snapshots.find(s => s.data.id === original.id);
			assert(snapshot !== undefined, "guild wasn't archived");
			stripGuild(snapshot.data);
			return { expectedObject: stripGuild(structuredClone(original)), snapshot };
		},
		_ => ({ name: "community server" }),
	)),
	test("latest channel snapshots match", (t) => compareLatestSnapshots(
		t,
		{
			type: RequestType.GetChannels,
			guildID: guild.id,
		},
		guild.channels,
		async (channel, snapshots, t) => {
			const snapshot = snapshots.find(s => s.data.id === channel.id);
			assert(snapshot !== undefined, "channel wasn't archived");
			if (channel.available_tags != null) {
				await t.test("latest forum tags snapshots match", (t) => compareLatestSnapshots(
					t,
					{
						type: RequestType.GetForumTags,
						channelID: channel.id,
					},
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
	test("latest thread snapshots match", (t) => compareLatestSnapshots(
		t,
		{
			type: RequestType.GetThreads,
			parentID: "1367557310872031334",
		},
		guild.threads,
		async (original, snapshots) => {
			const snapshot = snapshots.find(s => s.data.id === original.id);
			assert(snapshot !== undefined, "thread wasn't archived");
			return { expectedObject: original, snapshot };
		},
		thread => ({ name: thread.name }),
	)),
	test("latest message snapshots match", (t) => compareLatestSnapshots(
		t,
		{
			type: RequestType.GetMessages,
			channelID: "1367557310872031334",
		},
		messages.filter(entry => entry.data.channel_id === "1367557310872031334"),
		async (original, snapshots) => {
			const snapshot = snapshots.find(s => s.data.id === original.data.id);
			assert(snapshot !== undefined, "message wasn't archived");
			stripMessage(snapshot.data);
			return { expectedObject: original.data, snapshot };
		},
		entry => entry.options,
	)),
	test("latest role snapshots match", (t) => compareLatestSnapshots(
		t,
		{
			type: RequestType.GetRoles,
			guildID: guild.id,
		},
		guild.roles,
		async (original, snapshots) => {
			const snapshot = snapshots.find(s => s.data.id === original.id);
			assert(snapshot !== undefined, "role wasn't archived");
			return { expectedObject: original, snapshot };
		},
		role => ({ name: role.name }),
	)),
	test("latest emoji snapshots match", (t) => compareLatestSnapshots(
		t,
		{
			type: RequestType.GetGuildEmojis,
			guildID: guild.id,
		},
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
	test("emoji uploaders are missing", () => {
		assert.equal(
			request({
				type: RequestType.CheckForMissingEmojiUploaders,
				guildID: guild.id,
			}),
			true,
		);
	}),
]);

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
		{
			type: RequestType.GetGuildEmojis,
			guildID: guild.id,
		},
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


test("previous message snapshots match", async (t) => {
	for (const entry of messageEdits) {
		request({
			type: RequestType.AddMessageSnapshot,
			message: entry.data,
			timestamp: entry.timestamp,
		});

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
				timing: null,
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

test("no messages have been marked as deleted", () => {
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

test("messages can be marked as deleted", async () => {
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
