import test from "node:test";
import assert from "node:assert/strict";
import { getDatabaseConnection, RequestType } from "./index.js";
import { GatewayGuildCreateDispatchPayload, MemberFlag } from "../discord-api/types.js";

type RecursiveExtension<T> =
	T extends (infer ArrayMemberType)[] ? RecursiveExtension<ArrayMemberType>[] :
	T extends object ? {
		[Property in keyof T]: RecursiveExtension<T[Property]>;
	} & Record<string, unknown> :
	T;

const guild: RecursiveExtension<GatewayGuildCreateDispatchPayload["d"]> = {
	member_count: 6,
	owner_configured_content_level: 0,
	members: [
		{
			avatar: null,
			banner: null,
			communication_disabled_until: null,
			deaf: false,
			flags: 0 as MemberFlag,
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
	nsfw_level: 0,
	afk_channel_id: null,
	max_stage_video_channel_users: 50,
	profile: null,
	latest_onboarding_question_id: null,
	hub_type: null,
	explicit_content_filter: 2,
	rules_channel_id: "1367557310872031334",
	system_channel_flags: 15,
	id: "1367557310418784356",
	region: "deprecated",
	name: "Archiver Test Server",
	moderator_reporting: null,
	home_header: null,
	stickers: [],
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
			version: "1746121982997",
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
			position: 2,
			tags: {},
			unicode_emoji: null,
			version: "1746122089189",
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
			position: 1,
			tags: {
				guild_connections: null,
			},
			unicode_emoji: null,
			version: "1746122078477",
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
			position: 1,
			tags: {
				bot_id: "1367562333853061130",
			},
			unicode_emoji: null,
			version: "1746122861935",
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
			position: 1,
			tags: {
				bot_id: "159800228088774656",
			},
			unicode_emoji: null,
			version: "1755619817432",
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
			position: 1,
			tags: {
				bot_id: "270904126974590976",
			},
			unicode_emoji: null,
			version: "1755620645220",
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
	embedded_activities: [],
	verification_level: 1,
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
	],
	unavailable: false,
	inventory_settings: null,
	incidents_data: null,
	owner_id: "1367556342314827907",
	large: false,
	nsfw: false,
	preferred_locale: "en-US",
	vanity_url_code: null,
	max_members: 25000000,
	description: null,
	stage_instances: [],
	icon: null,
	application_id: null,
	soundboard_sounds: [],
	afk_timeout: 300,
	activity_instances: [],
	max_video_channel_users: 25,
	system_channel_id: "1367557310872031334",
	premium_tier: 0,
	premium_progress_bar_enabled: false,
	presences: [],
	banner: null,
	premium_subscription_count: 0,
	application_command_counts: {},
	mfa_level: 0,
	default_message_notifications: 1,
	discovery_splash: null,
	guild_scheduled_events: [],
	safety_alerts_channel_id: null,
	version: "1746123569055",
	lazy: true,
	splash: null,
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
			last_message_id: "1407492614294601849",
			last_pin_timestamp: "2025-05-01T18:26:08+00:00",
			name: "general",
			parent_id: "1367557310418784358",
			permission_overwrites: [],
			position: 0,
			rate_limit_per_user: 0,
			topic: null,
			type: 0,
			version: "1746123968578",
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
	voice_states: [],
	public_updates_channel_id: "1367558065943089234",
	features: [
		"NEWS",
		"COMMUNITY",
	],
	premium_features: null,
	joined_at: "2025-05-01T18:07:41.962000+00:00",
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
};


const db = await getDatabaseConnection(":memory:");

try {
	// These tests all use the same database connection and must run in order.

	await test("transaction is rolled back when the callback rejects", async () => {
		await assert.rejects(
			db.transaction(() => {
				db.request({
					type: RequestType.AddGuildSnapshot,
					guild,
					timing: {
						timestamp: 1000,
						realtime: false,
					},
				});
				throw new Error("Oops!");
			}),
			new Error("Oops!"),
		);

		const storedGuilds = [];
		for await (const storedGuild of db.iteratorRequest({ type: RequestType.GetGuilds })) {
			storedGuilds.push(storedGuild);
		};
		assert.equal(storedGuilds.length, 0);
	});

	await test("transaction is committed when the callback resolves", async () => {
		db.transaction(() => {
			db.request({
				type: RequestType.AddGuildSnapshot,
				guild,
				timing: {
					timestamp: 1000,
					realtime: false,
				},
			});
		});

		const storedGuilds = [];
		for await (const storedGuild of db.iteratorRequest({ type: RequestType.GetGuilds })) {
			storedGuilds.push(storedGuild);
		};
		assert.equal(storedGuilds.length, 1);
		assert.deepEqual(storedGuilds[0].data.id, guild.id);
	});

	await test("requests are buffered", async () => {
		db.request({
			type: RequestType.AddGuildSnapshot,
			guild: { ...guild, id: String(BigInt(guild.id) + 1n) },
			timing: {
				timestamp: 1000,
				realtime: false,
			},
		});
		db.request({
			type: RequestType.AddGuildSnapshot,
			guild: { ...guild, id: String(BigInt(guild.id) + 2n) },
			timing: {
				timestamp: 1000,
				realtime: false,
			},
		});

		const storedGuilds = [];
		for await (const storedGuild of db.iteratorRequest({ type: RequestType.GetGuilds })) {
			storedGuilds.push(storedGuild);
		};
		assert.equal(storedGuilds.length, 3);
	});
} finally {
	db.close();
}


await test("closing", async (t) => {
	await t.test("requests before closure are resolved", async () => {
		const db = await getDatabaseConnection(":memory:");
		const promise = db.request({ type: RequestType.Optimize });
		db.close();
		await promise;
	});

	await t.test("requests after closure are rejected", async () => {
		const db = await getDatabaseConnection(":memory:");
		db.close();
		await assert.rejects(
			db.request({ type: RequestType.Optimize }),
			new Error("The database connection was closed."),
		);
	});
});
