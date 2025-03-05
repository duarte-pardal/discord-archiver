/** @fileoverview Checks the consistency of the file store with respect to the database. */

import { parseArgs, ParseArgsConfig } from "node:util";
import { getDatabaseConnection } from "./db/index.js";
import { FileStore } from "./db/file-store.js";

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
		"delete-extra-files": {
			type: "boolean",
			short: "d",
		},
	},
} satisfies ParseArgsConfig;

const {
	values: options,
	positionals,
} = parseArgs(args);
if (positionals.length !== 1) {
	console.error("\
Usage: node check-file-store.js [-d | --delete-extra-files] [--file-store-path <path>] <database path>");
} else {
	const fileStorePath = options["file-store-path"] ?? `${positionals[0]}-files`;

	const db = await getDatabaseConnection(positionals[0], options["sync-sqlite"] ?? false);

	const fileStore = new FileStore(fileStorePath, db);
	await fileStore.open(true);

	const result = await fileStore.checkConsistency(options["delete-extra-files"]);
	console.log(`\
${result.missingFiles.size} missing files referenced in the database.${result.missingFiles.size === 0 ? " No data has been lost." : " Some data might have been lost."}
${result.extraFiles.size} extra files in the file store directory not referenced in the database.${result.extraFiles.size === 0 ? "" : options["delete-extra-files"] ? " They have been deleted." : " Use -d to delete them."}`);

	await fileStore.close();
	await db.close();
}
