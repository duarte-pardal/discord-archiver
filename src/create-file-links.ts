/** @fileoverview Creates file system links with human-readable names for the file store. */

import { parseArgs, ParseArgsConfig } from "node:util";
import { getDatabaseConnection, RequestType } from "./db/index.js";
import { link, mkdir } from "node:fs/promises";
import { basename } from "node:path/posix";
import { platform } from "node:process";

const args = {
	strict: true,
	allowPositionals: true,
	options: {
		"sync-sqlite": {
			type: "boolean",
		},
		"file-store-path": {
			type: "string",
		},
	},
} satisfies ParseArgsConfig;

const {
	values: options,
	positionals,
} = parseArgs(args);
if (positionals.length !== 1) {
	console.error("\
Usage: node create-file-links.js [--file-store-path <path>] <database path>");
	process.exit(1);
}

const fileStorePath = options["file-store-path"] ?? `${positionals[0]}-files`;

const db = await getDatabaseConnection(positionals[0], options["sync-sqlite"] ?? false);

await mkdir(`${fileStorePath}/links`).catch((err: unknown) => {
	if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
		throw err;
	}
});

const WINDOWS_RESERVED_CHAR_REGEX = /[<>:"/\\|?*]/g;
const FILE_NAME_REGEX = /^(?<name>.*)\.(?<extension>.*)$/;

for await (const file of db.iteratorRequest({ type: RequestType.GetFiles })) {
	if (file.errorCode != null) continue;
	const url = new URL(file.url);
	let name = basename(url.pathname);
	if (platform === "win32") {
		name = name.replace(WINDOWS_RESERVED_CHAR_REGEX, "_");
	}
	const stringifiedHash = Buffer.from(file.hash!).toString("base64url");
	const splitName = FILE_NAME_REGEX.exec(name);
	name = splitName === null ?
		`${name}-${stringifiedHash.slice(0, 4)}` :
		`${splitName.groups!.name}-${stringifiedHash.slice(0, 4)}.${splitName.groups!.extension}`;
	try {
		console.info(`${fileStorePath}/links/${name} = ${file.url}`);
		await link(`${fileStorePath}/${stringifiedHash}`, `${fileStorePath}/links/${name}`);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
			throw err;
		}
	}
}

db.close();
