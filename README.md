# Discord Archiver

> [!IMPORTANT]
> This project is experimental and incomplete. While it works reasonably well, there are many features missing and many things, including the database format and the name of the project, may change. Archives produced by this version might not be usable with later versions.

Discord Archiver is an application that downloads and archives data from [Discord](https://discord.com/). It allows you to archive entire servers, as well as keeping the archive up&hyphen;to&hyphen;date in realtime. Discord Archiver archives messages, users, servers, roles, channels and threads (called “objects” from now on). It’s designed to handle large amounts of data and can use multiple accounts at the same time to archive content faster.

The archiver can archive already&hyphen;created objects (e.g. message history), and also new objects as soon as they’re created. It archives past messages from multiple channels concurrently, allowing it to easily archive **thousands of messages per second** if they are spread among enough channels, up to a maximum of 5000 messages per second per bot account (this is a limit imposed by Discord). It keeps a log of all changes to objects, allowing you to see how any server looked like at any point in time. Information is never deleted from the database, so past versions of objects and deleted objects are always accessible.

## Use cases

- **Live backup:** Many people have somewhat valuable information stored on Discord. This information can become inaccessible if the server gets raided or deleted by Discord, or if Discord is unavailable for you for some reason.
- **Better searching:** Having a local copy allows you to search through the data in any way you want. For example, you can search for attachments with a specific file extension, and even search for text inside images. (Though this is not currently implemented.)
- **Server moderation:** Being able to see deleted and modified content can help you take appropriate action.

## Installation

1. Install Node.js v22.0.0 or later and npm
2. Either:
   - Download [this repo’s files](https://github.com/duarte-pardal/discord-archiver/archive/refs/heads/main.zip) and extract them, or
   - Install Git and run `git clone --depth 1 https://github.com/duarte-pardal/discord-archiver.git`
3. Open a command prompt / terminal in the directory with the files.
4. Run
   ```sh
   npm install && npm run build
   ```

## Archiving

The archiver requests data from Discord and writes it into the database file (and file store directory, if configured to download files). The database file will be created if it doesn’t exist.

Usage:

```
node ./build/archiver/index.js (-d | --database) <database file path> ((-c | --config-file) <config file path> | --config <config>) [--log (error | warning | info | verbose | debug)] [--stats (yes | no | auto)] [--file-store <file store directory path>]
```

- `(-d | --database) <database file path>`: Sets the path to the database file.
- `(-c | --config-file) <config file path>`: Sets the path to the JSON5 configuration file.
- `--config <config>`: Sets the configuration directly from the command line. This parameter expects the configuration in the same format as it would appear in the configuration file.
- `--log <level>`: Sets the max logging level. See logging section below.
- `--stats (yes | no | auto)`: Enables/disables showing sync statistics.
  - `yes`: Always output statistics to standard error
  - `no`: Never output statistics to standard error
  - `auto`: Output statistics to standard error if it is connected to a terminal/console
- `--file-store <file store directory path>`: Sets the path to the file store directory. This defaults to the database file path concatenated with `-files`.

## Quick start

Create a file called `config.json5` with the following content:

```json5
{
  accounts: [{
    token: "Bot <YOUR TOKEN HERE>"
  }],
}
```

Then run the archiver like so:

```sh
node ./build/archiver/index.js --log verbose -d archive.dsa -c config.json5
```

That’s it! The archiver will download and store all messages from all channels it has access to by default, but you can configure exactly what is archived and how. Check the [configuration documentation](doc/config.md) for more information.

### Logging

All logs are sent to standard output. There are 5 logging levels:

- `error`: unexpected events requiring immediate user attention
- `warning`: events that can cause problems (i.e. events that cause the database to become out of sync)
- `info`: relevant informative messages
- `verbose`: less relevant informative messages
- `debug`: most data sent to and received from Discord and all operations performed on the database; rarely useful except for debugging the archiver

You can set the maximum level using the `--log` option. For example, `--log verbose` makes the application log all `error`, `warning`, `info` and `verbose` messages, but not `debug` ones. The default maximum level is `info`, which is rather quiet. If you want to see what the archiver is doing, use `--log verbose`.

## Viewing the archived data

There are plans to build an archive browser that would let you browse the archive using the Discord UI you’re familiar with, as well as an application that exports the data to human&hyphen;readable formats. For now, there’s only a search utility, but you can also open the archive file with the SQLite CLI or an SQLite viewer. Every time the archiver archives an object for the first time or detects a change in an already-stored object, it records a snapshot of the object to the database. The snapshots are identified by the timestamp at which the data was retrieved from Discord. Check the `schema.sql` file for more info about the database format.

### Searching

You can use the included search CLI application to search for messages both while the archiver is running and when it is not.

Usage:

```sh
node ./build/apps/search.js <database path>
```

The search application provides an interactive prompt on the terminal where you can input your queries. It uses the SQLite FTS5 extension. This allows for very fast searching but you can’t search for arbitrary substrings. You must use the [SQLite FTS5 syntax](https://www.sqlite.org/fts5.html#full_text_query_syntax) in your queries.

Query examples:

- `alpha beta`: messages that contain the word “alpha” and the word “beta”
- `"alpha beta"`: messages that contain the expression “alpha beta”
- `alpha OR beta`: messages that contain the word “alpha” or the word “beta” or both
- `lov*`: messages that contain a word that starts with “lov” (love, loving, loved, lovely, etc.)

## Current to&hyphen;do list

- Archiving
  - **User account support**
    - **Import user account settings from HAR**
  - **Archive stickers and soundboard sounds**
  - **Archive DM channels**
  - **Allow thread enumeration to be interrupted**
  - **Fix switching accounts on permission changes (or remove multi-account support)**
  - **Archive private threads without manage permission**
  - **Include embeds in the FTS index**
  - **Include image text (OCR) in the FTS index**
  - **Option to archive newer messages first**
  - **Restart without reidentifying**
  - **Fancy UI**
  - **Voice chat archiving?**
- Importing
  - **From HTTP archive (HAR) format**
  - **From [DiscordChatExporter](https://github.com/Tyrrrz/DiscordChatExporter/)’s format**
  - **From raw JSON API responses**
- Exporting
  - **To plain text**
  - **To HTML**
  - **To [DiscordChatExporter](https://github.com/Tyrrrz/DiscordChatExporter/)’s format**
  - **To Discord (restore server from backup)**
- **Archive viewer**
- Basic message search CLI
  - **Search using substrings and regular expressions**
- Common to all code
  - **[Bun](https://bun.sh/) runtime support**
  - **Standalone CLI app**

## Copyright and disclaimers

Copyright © Duarte Pardal

This project is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.

This project is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this project. (Look for a file named `LICENSE.txt`.) If not, see <https://www.gnu.org/licenses/>. 
