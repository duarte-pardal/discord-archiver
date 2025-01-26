/** @fileoverview Handles the file store. */

// The file store is a directory structure that contains downloaded files. Each file is identified
// by the hash of its content, to prevent wasting space with duplicate files.
//
// Care has been taken to make sure that the operation of adding a file into the file store is
// atomic with the transaction that adds the association between the URL and the file in the
// database and the object snapshot (for example, a message with attached files or a user with a
// profile picture) that mentions the URL. When a file is added, the following operations are
// performed in sequence:
//
// 1. Download the file to the pending directory until completion.
// 2. In the same transaction, add the snapshot and the URL-hash association.
// 3. Move the file from the pending directory to the main directory and rename it to the hash.

import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { ReadableStream } from "node:stream/web";
import { fetch } from "undici";
import { abortError, timeout } from "../util/abort.js";
import log from "../util/log.js";
import { isFetchAbortError } from "../util/http.js";
import { DatabaseConnection, RequestType } from "../db/index.js";

const EXTENSION_REGEX = /\.[\w-]{1,20}$/;
const ACCEPT_BYTE_RANGES_REGEX = /(?:,|^)\s*bytes\s*(?:,|$)/;
// TODO: Switch to BLAKE2b 256 (implemented in Bun but not in Node.js)

/**
 * Initializes the file store directory structure if needed and moves pending files which finished
 * downloading. */
export async function openFileStore(fileStorePath: string, db: DatabaseConnection): Promise<void> {
	const pendingDirPath = `${fileStorePath}/pending`;
	// Also creates the main file store dir.
	await fs.promises.mkdir(pendingDirPath, { recursive: true });
	for (const name of await fs.promises.readdir(pendingDirPath)) {
		await new Promise<void>((res, rej) => {
			const hasher = crypto.createHash("sha256");
			const pendingFilePath = `${pendingDirPath}/${name}`;
			const readStream = fs.createReadStream(pendingFilePath);
			readStream.once("error", () => {
				readStream.close();
				rej();
			});
			readStream.pipe(hasher, { end: true });
			hasher.once("readable", () => {
				res((async () => {
					const hash = hasher.read();
					const hashUsed = await db.request({
						type: RequestType.GetFileHashUtilization,
						hash,
					});
					const stringifiedHash = hash.toString("base64url");
					if (hashUsed) {
						log.verbose?.(`Settling pending file with hash ${stringifiedHash}.`);
						await fs.promises.rename(pendingFilePath, `${fileStorePath}/${stringifiedHash}`);
					} else {
						log.verbose?.(`Removing incomplete pending file with hash ${stringifiedHash}.`);
						try {
							await fs.promises.unlink(pendingFilePath);
						} catch {}
					}
				})());
			});
		});
	}
}

export async function closeFileStore(fileStorePath: string): Promise<void> {
	try {
		await fs.promises.rmdir(`${fileStorePath}/pending`);
	} catch (err) {
		log.warning?.(`WARNING: Couldn't remove the file store's pending directory (${(err as NodeJS.ErrnoException).message}). This is usually not problematic. There might be some extra files there not created by this program.`);
	}
}


export type PendingFileInfo = { url: string } & (
	{
		errorStatusCode: number;
	} |
	{
		errorStatusCode: null;
		hash: Buffer;
		temporaryPath: string | null;
		extension: string;
	}
);

export async function downloadFile(fileStorePath: string, url: string, abortSignal: AbortSignal): Promise<PendingFileInfo> {
	const parsedURL = new URL(url);

	const extension = EXTENSION_REGEX.exec(parsedURL.pathname)?.[0] ?? "";
	const temporaryName = (Math.floor(Math.random() * 0x100000000)).toString(16);
	const temporaryPath = fileStorePath + `/pending/${temporaryName}`;

	// Download and hash the file
	const file = await fs.promises.open(temporaryPath, "w");
	const hasher = crypto.createHash("sha256");
	let interval = 0;
	let rangeRequestsSupported = false;
	let downloadedBytes = 0;
	let totalBytes = NaN;
	let errorStatusCode;
	log.debug?.(`Requesting the file at <${url}>.`);
	try {
		// Retry the request if it failed
		while (true) {
			// This looks dumb but it's the simplest way of distinguishing the sources of errors.
			let errorContext: "none" | "fetch" | "fs" = "none";

			try {
				errorContext = "fetch";
				const response = await fetch(url, {
					signal: abortSignal,
					headers: rangeRequestsSupported ? {
						Range: `bytes=${downloadedBytes}-`,
					} : {},
				});
				errorContext = "none";

				if (
					response.status === 429 /* Too Many Requests */ ||
					response.status === 500 /* Internal Server Error */ ||
					response.status === 503 /* Service Unavailable */
				) {
					log.verbose?.(`Got HTTP ${response.status} ${response.statusText} response while requesting the file at <${url}>. Retrying.`);
				} else if (!response.ok) {
					// Impossible to download file
					log.debug?.(`Got HTTP error (HTTP ${response.status} ${response.statusText}) while requesting the file at <${url}>.`);
					errorStatusCode = response.status < 0 ? 0 : response.status;
					break;
				} else {
					// Successful response
					const contentRange = response.headers.get("Content-Range");
					if (response.status === 200 && contentRange === null) {
						// Full content response
						if (downloadedBytes !== 0) {
							errorContext = "fs";
							await file.truncate(0);
							errorContext = "none";
						}

						// Check if we can make range requests
						totalBytes = Number.parseInt(response.headers.get("Content-Length") ?? "");
						if (totalBytes < 0) {
							totalBytes = NaN;
						}
						rangeRequestsSupported = !Number.isNaN(totalBytes) && ACCEPT_BYTE_RANGES_REGEX.test(response.headers.get("Accept-Ranges") ?? "");

					} else if (!(rangeRequestsSupported && response.status === 206 && contentRange === `bytes ${downloadedBytes}-${totalBytes-1}/${totalBytes}`)) {
						// Not a valid full content response nor an expected and valid partial content response
						log.warning?.(`Got HTTP ${response.status} ${response.statusText} and Content-Range: ${contentRange} while requesting the file at <${url}>. This file will not be archived.`);
						errorStatusCode = -1;
						break;
					}

					if (response.body === null) {
						log.warning?.(`Response body is null for <${url}>.`);
						errorStatusCode = -1;
						break;
					} else {
						errorContext = "fetch";
						for await (const chunk of response.body as ReadableStream<Uint8Array>) {
							errorContext = "none";
							downloadedBytes += chunk.byteLength;
							hasher.update(chunk);
							errorContext = "fs";
							await file.write(chunk);
							errorContext = "fetch";
						}

						// End of body: entire file successfully downloaded
						errorStatusCode = null;
						break;
					}
				}
			} catch (err) {
				if (errorContext === "fetch" && isFetchAbortError(err)) {
					throw abortError;
				} else if (errorContext === "fetch" && err instanceof TypeError) {
					log.warning?.(`Network error while requesting the file at <${url}>: ${err.message}`);
				} else if (errorContext === "fs") {
					throw err;
				} else {
					throw err;
				}
			}
			await timeout(interval, abortSignal);
			interval = Math.min(interval + 2_000, 60_000);
		}
	} catch (err) {
		// Cleanup on abort or unrecoverable error
		await file.close();
		await fs.promises.unlink(temporaryPath);
		throw err;
	}

	if (errorStatusCode !== null) {
		await file.close();
		await fs.promises.unlink(temporaryPath);
		return {
			url,
			errorStatusCode,
		};
	} else {
		// Entire file successfully downloaded
		await file.sync();
		await file.close();

		const hash = hasher.digest();

		const hashPath = `${fileStorePath}/${hash.toString("base64url")}`;

		// Check if we already have a file with the same content archived
		try {
			await fs.promises.stat(hashPath);
			// An equal file exists
			log.debug?.(`There's a stored file equal to the file at <${url}> with hash ${hash.toString("base64url")}.`);
			await fs.promises.unlink(temporaryPath);
			return {
				url,
				errorStatusCode: null,
				hash,
				temporaryPath: null,
				extension,
			};
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
				throw err;
			}
			// No equal file exists
			log.debug?.(`The file at <${url}> with hash ${hash.toString("base64url")} is unique and will be stored.`);
			return {
				url,
				errorStatusCode: null,
				hash,
				temporaryPath,
				extension,
			};
		}
	}
}

export async function settleFile(fileStorePath: string, temporaryPath: string, hash: Buffer): Promise<void> {
	await fs.promises.rename(temporaryPath, `${fileStorePath}/${hash.toString("base64url")}`);
}
