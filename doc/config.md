# Configuration

Discord Archiver provides a flexible and comprehensive configuration system to control which data is archived and how.

This project accepts configuration in the [JSON5 format](https://spec.json5.org/), but you can also use the classic [JSON format](https://www.json.org/).

## Basic structure

Example:

```json5
{
  accounts: [
    {
      name: "the main account",
      token: "Bot xxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  ],

  // Default options
  options: {
    downloadAuthorAvatars: true,
    downloadAttachments: true,

    // Don't store the member list by default
    requestAllMembers: false,
    storeMemberEvents: false,
    downloadAllMemberAvatars: true // only has effect if `requestAllMembers` is `true`
  },

  // Option overrides
  overrides: [
    // Store the member list and download all of the members' avatars only on this server
    {
      type: "server",
      id: "1",

      requestAllMembers: true,
      storeMemberEvents: true
    }

    // Ignore this channel and everything inside it, including its threads
    {
      type: "channel",
      id: "2",

      archiveChannels: false
    }

    // Archive this channel, but ignore all of its threads
    {
      type: "channel",
      id: "3",

      archiveThreads: false
    }
  ],

  mediaConfig: {
    // Download static avatars in the JPEG format with a 512x512 resolution
    avatar: {
      format: "jpeg",
      queryParams: "size=512"
    },

    // Download animated avatars in the Graphics Interchange Format (GIF) with a 256x256 resolution
    animatedAvatar: {
      format: "gif",
      queryParams: "size=256"
    }
  }
}
```


## Accounts

Each account is specified as an object in the `accounts` array with the following structure:

- `name` (string): A human&hyphen;readable name for the account.
- `token` (string): The Discord token.
- `gatewayIdentifyData` (object): The data to send in the identify payload when connecting to the Gateway. May include fields such as `presence`. Check the [Discord documentation](https://discord.com/developers/docs/events/gateway-events#identify) for all fields.

## Options

Options control what information about each object (server, channel, etc.) is archived.


### Object hierarchy

Each thread is a sub&hyphen;object of its parent channel. Each guild channel is a sub&hyphen;object of its guild. A sub&hyphen;object inherits all options from the parent object, except those which are overridden.


### Default options

The default options are specified in the `options` object.


### Overrides

Each override is specified as an object in the `overrides` array with the following structure:

- `type`: The type of object this override applies to. Must be either `"server"`, `"channel"`, or `"thread"`.
- `id`: The Discord snowflake/ID of the object.
- the options to be overridden

Overrides of type `"channel"`, or `"thread"` may only include channel options. Overrides of type `"server"` may include channel options and server options.


### Options that control which objects are archived

The `archiveServers`, `archiveChannels`, `archiveThreads`, and `archiveMessages` are boolean options that default to `true`. They control whether information about a given object will be stored in the database. Here, “information about a given object” doesn’t include information about sub&hyphen;objects. For example, for servers, this information includes the server name and icon but excludes the channel list.

All sub&hyphen;objects of objects that aren’t archived will not be archived, regardless of overrides. This means that, for example, the following configuration will not archive any channels in the server with ID 1:

```json5
{
  overrides: [
    {
      type: "server",
      id: "1",

      // Don't do this!
      archiveServers: false,
      archiveChannels: true
    }
  ]
}
```


### Channel options

#### `storeNewMessages` (boolean)

Controls whether to store new messages sent in this channel as soon as they are sent.

#### `storeMessageEdits` (boolean)

Controls whether to store edits to messages from this channel and deletions of messages from this channel as soon as they are edited/deleted.

#### `downloadAuthorAvatars` (boolean)

Controls whether to download and store the avatars of messages’ authors.

#### `downloadAttachments` (boolean)

Controls whether to download message attachments.

#### `downloadEmbeddedImages` (boolean)

Controls whether to download embedded images, including thumbnails.

#### `downloadEmbeddedVideos` (boolean)

Controls whether to download embedded videos.

#### `downloadEmojisInMessages` (boolean)

Controls whether to download the images for all of the emojis in the content of affected messages.

#### `downloadEmojisInReactions` (boolean)

Controls whether to download the images for all of the emojis in the reactions of affected messages.

#### `reactionArchivalMode`

Controls how to archive reactions. It may be one of:

- `none`: Reactions aren’t archived.
- `users`: The list of users who reacted with each emoji is archived.

A mode that archives only the reaction counts is planned.

#### `storeReactionEvents` (boolean)

Controls whether to store when users place or remove a reaction to a message, as soon as the reaction is placed/removed.

#### `storeNewChannels` (boolean)

Controls whether to store new channels as soon as they are created.

#### `storeChannelEdits` (boolean)

Controls whether to store edits to channel properties and channel deletions as soon as they are edited/deleted.

#### `requestPastMessages` (boolean)

Controls whether to download and store messages already sent. Messages are requested from oldest to newest.

#### `requestArchivedThreads` (boolean)

Controls whether to download and store archived threads. Archived threads are requested from newest to oldest.

Messages inside archived threads will also be downloaded and stored, depending on the value of the `requestPastMessages` option.


### Server options

#### `storeServerEdits` (boolean)

Controls whether to store edits to server properties, roles, emojis, stickers and soundboard sounds as soon as they are edited.

#### `requestAllMembers` (boolean)

Controls whether to request all members in the server in order to find out which members joined/left while the archiver was not running, i.e., whether to keep the member list synced with Discord.

#### `storeMemberEvents` (boolean)

Controls whether to record when members from this server join, leave, change nickname, etc. in real time. Members who left the server and previous snapshots of members are kept in the database.

#### `downloadAllMemberAvatars` (boolean)

Controls whether to download and store the avatars of the all server members.

#### `downloadServerAssets` (boolean)

Controls whether to download and store the server’s icon, banner, home header, splash image and discovery splash image.

#### `downloadExpressions` (boolean)

Controls whether to download and store the images/audio for all server emojis, stickers and soundboard sounds. Details about emojis, stickers and soundboard sounds, such as their names, are always archived as long as the server is archived.

#### `requestExpressionUploaders` (boolean)

Controls whether to request information about the users who uploaded each emoji, sticker and soundboard sound, in case there’s an account with permission to view the uploaders (create expressions permission or manage expressions permission). This option has no effect if no accounts have permission to view the uploaders.


## Media download options

Each entry in `mediaConfig` may contain the following properties:

- `format` (string): one of `"png"`, `"jpeg"`, `"webp"` or `"gif"`. `"gif"` might not be available for images from certain sources (this is a Discord limitation).
- `queryParams` (string): the parameters to use when requesting the image. Check the [official documentation](https://discord.com/developers/docs/reference#cdn-parameters) for a list of all officially supported parameters and values or the [unofficial documentation](https://docs.discord.food/reference#cdn-parameters) for a list of all known parameters and values.

### Format selection

If you want the highest quality possible, you should use the following configuration:

```json5
mediaConfig: {
  defaultImage: {
    format: "webp",
    queryParams: "size=4096&quality=lossless",
  },
  defaultAnimatedImage: {
    format: "webp",
    queryParams: "size=4096&quality=lossless&animated=true",
  }
}
```

The WebP format generally provides better lossy compression than JPEG (for the same quality) and better lossless compression than PNG. It’s also the only format that Discord supports for downloading animated images with lossless compression (that is, without any loss of quality relative to what was uploaded).
