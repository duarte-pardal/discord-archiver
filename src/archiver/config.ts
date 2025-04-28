import { z } from "zod";
import JSON5 from "json5";

type PartialProps<T> = { [P in keyof T]?: T[P] | undefined; };

type CommonComputedOptions = {
	archive: boolean;
};

const INTEGER_REGEX = /^\d+$/;
function snowflakeChecker(value: unknown) {
	return typeof value === "string" && INTEGER_REGEX.test(value);
}
const Snowflake = z.custom(snowflakeChecker);

const MessageOptions = z.object({
	/** Whether to store this channel/server in the database. If false, no information about this channel/server and any sub-objects (like messages) will be stored. */
	archiveMessages: z.boolean(),
	storeNewMessages: z.boolean(),
	storeMessageEdits: z.boolean(),

	/** Whether to download and store the avatars of messages' authors */
	downloadAuthorAvatars: z.boolean(),
	/** Whether to download attachments. */
	downloadAttachments: z.boolean(),
	/** Whether to download embedded images, including thumbnails. */
	downloadEmbeddedImages: z.boolean(),
	/** Whether to download embedded videos. */
	downloadEmbeddedVideos: z.boolean(),
	/** Whether to download all of the emojis in the content of affected messages. */
	downloadEmojisInMessages: z.boolean(),
	/** Whether to download all of the emojis in the reactions of affected messages. */
	downloadEmojisInReactions: z.boolean(),

	/**
	 * Controls how to archive reactions.
	 *
	 * - `none`: Reactions aren't archived.
	 * - `users`: The list of users who reacted with each emoji is archived.
	 *
	 * This should not be changed after creating the database.
	 */
	reactionArchivalMode: z.union([z.literal("none"), z.literal("users")]),
	/** Whether to store when users place or remove a reaction to a message. */
	storeReactionEvents: z.boolean(),
});
export type MessageOptions = z.infer<typeof MessageOptions>;

const ChannelOptions = MessageOptions.extend({
	/** Whether to store this channel/server in the database. If false, no information about this channel/server and any sub-objects (like messages) will be stored. */
	archiveChannels: z.boolean(),
	archiveThreads: z.boolean(),
	storeNewChannels: z.boolean(),
	storeChannelEdits: z.boolean(),

	/** Whether to download and store past messages from affected channels. */
	requestPastMessages: z.boolean(),

	requestArchivedThreads: z.boolean(),
	// checkArchivedThreadsForNewMessages: z.boolean(),
});
type BaseChannelOptions = z.infer<typeof ChannelOptions>;
const PartialChannelOptions = ChannelOptions.partial();
type PartialChannelOptions = z.infer<typeof PartialChannelOptions>;
export type ChannelOptions = BaseChannelOptions & CommonComputedOptions;

const GuildOptions = ChannelOptions.extend({
	/** Whether to store this channel/server in the database. If false, no information about this channel/server and any sub-objects (like messages) will be stored. */
	archiveServers: z.boolean(),
	storeServerEdits: z.boolean(),

	/** Whether to request all members in the server in order to find out which members joined/left while the archiver was not running, i.e., whether to keep the member list synced with Discord. */
	requestAllMembers: z.boolean(),
	/** Whether to record when members from this server join, leave, change nickname, etc. in real time. Members who left the server and previous snapshots of members are kept in the database. */
	storeMemberEvents: z.boolean(),
	/** Whether to download and store the avatars of the all server members. */
	downloadAllMemberAvatars: z.boolean(),

	/** Whether to download and store the server's icon, banner, home header, splash image and discovery splash image. */
	downloadServerAssets: z.boolean(),

	/** Whether to download the images/audio for all server emojis, stickers and soundboard sounds. */
	downloadExpressions: z.boolean(),
	/** Whether to request information about who uploaded each emoji, sticker and soundboard sound. */
	requestExpressionUploaders: z.boolean(),
});
type BaseGuildOptions = z.infer<typeof GuildOptions>;
const PartialGuildOptions = GuildOptions.partial();
type PartialGuildOptions = z.infer<typeof PartialGuildOptions>;
export type GuildOptions = BaseGuildOptions & CommonComputedOptions;

const ChannelOptionsOverride = PartialChannelOptions.extend({
	type: z.union([z.literal("channel"), z.literal("thread")]),
	/** The channel ID. */
	id: Snowflake,
});
type ChannelOptionsOverride = z.infer<typeof ChannelOptionsOverride>;
const GuildOptionsOverride = PartialGuildOptions.extend({
	type: z.literal("server"),
	/** The server ID. */
	id: Snowflake,
});
type GuildOptionsOverride = z.infer<typeof GuildOptionsOverride>;
const OptionsOverride = z.union([ChannelOptionsOverride, GuildOptionsOverride]);
type OptionsOverride = z.infer<typeof OptionsOverride>;
type OverrideToOptions<O extends OptionsOverride> =
	O extends ChannelOptionsOverride ? ChannelOptions :
	O extends GuildOptionsOverride ? GuildOptions : never;

const AccountConfig = z.object({
	/** A name for the account, used to refer to the account in the user interface. */
	name: z.optional(z.string()),
	/** The Discord token, including the `Bot ` prefix, if applicable. */
	token: z.string(),
	/** The data to send in the identify payload when connecting to the Gateway. */
	gatewayIdentifyData: z.object({}).passthrough(),
});

const ImageOptions = z.object({
	format: z.union([z.literal("png"), z.literal("jpeg"), z.literal("webp")]),
	queryParams: z.string(),
});
export type ImageOptions = z.infer<typeof ImageOptions>;
const AnimatedImageOptions = z.object({
	format: z.union([z.literal("png"), z.literal("jpeg"), z.literal("webp"), z.literal("gif")]),
	queryParams: z.string(),
});
export type AnimatedImageOptions = z.infer<typeof AnimatedImageOptions>;

const MediaConfig = z.object({
	defaultImage: ImageOptions,
	defaultAnimatedImage: AnimatedImageOptions,

	avatar: ImageOptions,
	animatedAvatar: AnimatedImageOptions,

	serverIcon: ImageOptions,
	animatedServerIcon: AnimatedImageOptions,
	serverSplash: ImageOptions,
	serverDiscoverySplash: ImageOptions,
	serverBanner: ImageOptions,
	animatedServerBanner: AnimatedImageOptions,

	serverEmoji: ImageOptions,
	animatedServerEmoji: AnimatedImageOptions,
	usedEmoji: ImageOptions,
	animatedUsedEmoji: AnimatedImageOptions,
});
type MediaConfig = z.infer<typeof MediaConfig>;

const Config = z.object({
	accounts: z.array(AccountConfig).nonempty(),
	options: z.optional(PartialGuildOptions),
	overrides: z.optional(z.array(OptionsOverride)),
	/**
	 * The parameters used when downloading Discord images. Check [the docs](https://docs.discord.sex/reference#cdn-parameters) for a reference of all supported parameters.
	 *
	 * This should not be changed after creating the database, as it might cause the archiver to download various versions of the same media content.
	 */
	mediaConfig: z.optional(MediaConfig.partial()),
});
export type Config = z.infer<typeof Config>;
export type ParsedConfig = {
	accounts: Config["accounts"];
	options: GuildOptions;
	overrides: Config["overrides"];
	mediaConfig: MediaConfig;
};

export function isFileStoreNeeded(config: ParsedConfig): boolean {
	function containsDownloadOptions(options: PartialGuildOptions) {
		return (
			options.downloadAttachments === true ||
			options.downloadEmbeddedImages === true ||
			options.downloadEmbeddedVideos === true ||
			options.downloadEmojisInMessages === true ||
			options.downloadEmojisInReactions === true ||
			options.downloadServerAssets === true ||
			options.downloadExpressions === true
		);
	}

	if (containsDownloadOptions(config.options)) {
		return true;
	}
	for (const override of config.overrides ?? []) {
		if (containsDownloadOptions(override)) {
			return true;
		}
	}

	return false;
}

const DEFAULT_OPTIONS: Readonly<GuildOptions> = {
	archive: true,

	archiveMessages: true,
	storeMessageEdits: true,

	downloadAuthorAvatars: false,
	downloadAttachments: false,
	downloadEmbeddedImages: false,
	downloadEmbeddedVideos: false,
	downloadEmojisInMessages: false,
	downloadEmojisInReactions: false,

	reactionArchivalMode: "none",
	storeReactionEvents: true,


	archiveChannels: true,
	archiveThreads: true,
	storeChannelEdits: true,

	requestPastMessages: true,
	storeNewMessages: true,

	requestArchivedThreads: true,


	archiveServers: true,
	storeServerEdits: true,

	storeNewChannels: true,

	requestAllMembers: true,
	storeMemberEvents: true,
	downloadAllMemberAvatars: false,

	downloadServerAssets: false,

	downloadExpressions: false,
	requestExpressionUploaders: true,
};

const NO_ARCHIVE_OPTIONS: Readonly<GuildOptions> = {
	archive: false,

	archiveMessages: false,
	storeMessageEdits: false,

	downloadAuthorAvatars: false,
	downloadAttachments: false,
	downloadEmbeddedImages: false,
	downloadEmbeddedVideos: false,
	downloadEmojisInMessages: false,
	downloadEmojisInReactions: false,

	reactionArchivalMode: "none",
	storeReactionEvents: false,


	archiveChannels: false,
	archiveThreads: false,
	storeChannelEdits: false,

	requestPastMessages: false,
	storeNewMessages: false,

	requestArchivedThreads: false,


	archiveServers: false,
	storeServerEdits: false,

	storeNewChannels: false,

	requestAllMembers: false,
	storeMemberEvents: false,
	downloadAllMemberAvatars: false,

	downloadServerAssets: false,

	downloadExpressions: false,
	requestExpressionUploaders: false,
};

function combineOptions<B extends object>(partial: PartialProps<B>, base: B): B {
	const target = {} as B;
	for (const key in base) {
		target[key as keyof B] = partial[key as keyof B] ?? base[key as keyof B];
	}
	return target;
}

export async function parseConfig(json5Config: string): Promise<ParsedConfig> {
	const input = Config.parse(JSON5.parse(json5Config));

	const options = combineOptions(input.options ?? {}, DEFAULT_OPTIONS);

	const inputMediaConfig = input.mediaConfig ?? {};
	const defaultImageConfig = inputMediaConfig.defaultImage ?? {
		format: "webp",
		queryParams: "size=4096",
	};
	const defaultAnimatedImageConfig = inputMediaConfig.defaultAnimatedImage ?? {
		format: "webp",
		queryParams: "size=4096&animated=true",
	};
	const mediaConfig: MediaConfig = {
		defaultImage: defaultImageConfig,
		defaultAnimatedImage: defaultAnimatedImageConfig,
		avatar: inputMediaConfig.avatar ?? defaultImageConfig,
		animatedAvatar: inputMediaConfig.animatedAvatar ?? defaultAnimatedImageConfig,
		serverIcon: inputMediaConfig.serverIcon ?? defaultImageConfig,
		animatedServerIcon: inputMediaConfig.animatedServerIcon ?? defaultAnimatedImageConfig,
		serverSplash: inputMediaConfig.serverSplash ?? defaultImageConfig,
		serverDiscoverySplash: inputMediaConfig.serverDiscoverySplash ?? defaultImageConfig,
		serverBanner: inputMediaConfig.serverBanner ?? defaultImageConfig,
		animatedServerBanner: inputMediaConfig.serverBanner ?? defaultAnimatedImageConfig,
		serverEmoji: inputMediaConfig.serverEmoji ?? defaultImageConfig,
		animatedServerEmoji: inputMediaConfig.animatedServerEmoji ?? defaultAnimatedImageConfig,
		usedEmoji: inputMediaConfig.usedEmoji ?? defaultImageConfig,
		animatedUsedEmoji: inputMediaConfig.animatedUsedEmoji ?? defaultAnimatedImageConfig,
	};

	return {
		accounts: input.accounts,
		options,
		overrides: input.overrides,
		mediaConfig: mediaConfig,
	};
}

function getObjectOptions<O extends OptionsOverride>(
	parentOptions: OverrideToOptions<O>,
	overrides: OptionsOverride[] | undefined,
	type: O["type"],
	id: string,
	archiveKey: keyof OverrideToOptions<O>,
): Readonly<OverrideToOptions<O>> {
	const override = overrides?.find(o => o.type === type && o.id === id) as OverrideToOptions<O> | undefined;
	let options: Readonly<OverrideToOptions<O>>;
	if (override === undefined) {
		options = parentOptions;
	} else {
		options = combineOptions(override, parentOptions);
	}
	return options.archive && options[archiveKey] ? options : NO_ARCHIVE_OPTIONS as Readonly<OverrideToOptions<O>>;
}
export function getGuildOptions(config: ParsedConfig, id: string): GuildOptions {
	return getObjectOptions<GuildOptionsOverride>(config.options, config.overrides, "server", id, "archiveServers");
}
export function getChannelOptions(config: ParsedConfig, id: string, parentOptions = config.options): ChannelOptions {
	return getObjectOptions<ChannelOptionsOverride>(parentOptions, config.overrides, "channel", id, "archiveChannels");
}
export function getThreadOptions(config: ParsedConfig, id: string, parentOptions: ChannelOptions): ChannelOptions {
	return getObjectOptions<ChannelOptionsOverride>(parentOptions, config.overrides, "thread", id, "archiveThreads");
}
