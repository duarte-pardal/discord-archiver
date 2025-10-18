/** @fileoverview Handles file downloading. */

import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { ReadableStream } from "node:stream/web";
import { abortError, preventUnsettled, preventUnsettledIterable, timeout } from "../util/abort.js";
import log from "../util/log.js";
import { isFetchAbortError } from "../util/http.js";
import { ConcurrencyLimiter } from "../util/concurrency-limiter.js";
import { FileStore, OngoingFileAcquisition, PendingFileResult } from "../db/file-store.js";
import { AnimatedImageOptions, ImageOptions } from "./config.js";
import { DatabaseConnection } from "../db/index.js";
import { PartialCustomEmoji } from "../discord-api/types.js";
import { onFileDownload } from "./progress.js";

const ACCEPT_BYTE_RANGES_REGEX = /(?:,|^)\s*bytes\s*(?:,|$)/;
// TODO: Switch to BLAKE2b 256 (implemented in Bun but not in Node.js)

/** Unconditionally downloads a file to disk. The file on disk is deleted if there's another file with the same content. */
export async function downloadFile(
	fileStore: FileStore,
	abortSignal: AbortSignal,
	pendingPath: string,
	downloadURL: string,
): Promise<PendingFileResult> {
	if (abortSignal.aborted) {
		throw abortError;
	}

	// Download and hash the file
	const file = await fs.promises.open(pendingPath, "w");
	const hasher = crypto.createHash("sha256");
	let interval = 0;
	let rangeRequestsSupported = false;
	let downloadedBytes = 0;
	let totalBytes = NaN;
	let errorCode;
	try {
		if (abortSignal.aborted as boolean) {
			throw abortError;
		}
		log.debug?.(`Requesting the file at <${downloadURL}> (${pendingPath}).`);

		// Retry the request if it failed
		while (true) {
			// This looks dumb but it's the simplest way of distinguishing the sources of errors.
			let errorContext: "none" | "fetch" | "fs" = "none";

			try {
				errorContext = "fetch";
				const response: Response = await preventUnsettled(abortSignal, "download/fetch()", fetch(downloadURL, {
					signal: abortSignal,
					headers: rangeRequestsSupported ? {
						Range: `bytes=${downloadedBytes}-`,
					} : {},
				}));
				errorContext = "none";

				if (
					response.status === 429 /* Too Many Requests */ ||
					(response.status >= 500 && response.status < 600)
				) {
					log.warning?.(`Got HTTP ${response.status} ${response.statusText} response while requesting the file at <${downloadURL}>. Retrying.`);
					if (response.body != null) {
						for await (const _chunk of preventUnsettledIterable(abortSignal, "download/body", response.body)) {
							// Consume the body to prevent leaking resources
						}
					}
				} else if (!response.ok) {
					// Impossible to download file
					log.error?.(`Got HTTP ${response.status} ${response.statusText} while requesting the file at <${downloadURL}>. This file will not be downloaded.`);
					errorCode = response.status < 0 ? 0 : response.status;
					if (response.body != null) {
						for await (const _chunk of preventUnsettledIterable(abortSignal, "download/body", response.body)) {
							// Consume the body to prevent leaking resources
						}
					}
					break;
				} else {
					// Successful response
					const contentRange = response.headers.get("Content-Range");
					log.debug?.(`Got HTTP ${response.status} ${response.statusText} and Content-Range: ${contentRange} while requesting the file at <${downloadURL}>.`);
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
						log.error?.(`Got unexpected combination HTTP ${response.status} ${response.statusText} and Content-Range: ${contentRange} while requesting the file at <${downloadURL}>. This file will not be downloaded.`);
						errorCode = -1;
						if (response.body != null) {
							for await (const _chunk of preventUnsettledIterable(abortSignal, "download/body", response.body)) {
								// Consume the body to prevent leaking resources
							}
						}
						break;
					}

					if (response.body === null) {
						log.warning?.(`Response body is null for <${downloadURL}>.`);
						errorCode = -1;
						break;
					} else {
						errorContext = "fetch";
						for await (const chunk of preventUnsettledIterable(abortSignal, "download/body", response.body as ReadableStream<Uint8Array<ArrayBuffer>>)) {
							errorContext = "none";
							downloadedBytes += chunk.byteLength;
							hasher.update(chunk);
							errorContext = "fs";
							await file.write(chunk);
							errorContext = "fetch";
						}

						// End of body: entire file successfully downloaded
						errorCode = null;
						break;
					}
				}
			} catch (err) {
				if (errorContext === "fetch" && isFetchAbortError(err)) {
					throw abortError;
				} else if (errorContext === "fetch" && err instanceof TypeError) {
					log.warning?.(`Network error while requesting the file at <${downloadURL}>: ${err.message}`);
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
		log.debug?.(`The request for the file at <${downloadURL}> (${pendingPath}) was aborted or failed with an unexpected error.`);
		await file.close();
		await fs.promises.unlink(pendingPath);
		throw err;
	}

	if (errorCode !== null) {
		// Recoverable error
		log.debug?.(`The request for the file at <${downloadURL}> (${pendingPath}) failed with error code ${errorCode}.`);
		await file.close();
		await fs.promises.unlink(pendingPath);
		return {
			errorCode,
		};
	} else {
		// Entire file successfully downloaded
		await file.sync();
		await file.close();

		const hash = hasher.digest();

		const hashPath = fileStore.getHashedPath(hash);

		// Check if we already have a file with the same content archived
		try {
			await fs.promises.stat(hashPath);
			// An equal file exists
			log.debug?.(`There's a stored file equal to the file at <${downloadURL}> with hash ${hash.toString("base64url")}.`);
			await fs.promises.unlink(pendingPath);
			return {
				errorCode: null,
				hash,
				createdFile: false,
			};
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
				throw err;
			}
			// No equal file exists

			log.debug?.(`The file at <${downloadURL}> (${pendingPath}) with hash ${hash.toString("base64url")} is unique and will be stored.`);
			onFileDownload(downloadedBytes);
			return {
				errorCode: null,
				hash,
				createdFile: true,
			};
		}
	}
}

const fileDownloadLimiter = new ConcurrencyLimiter(8);

export type DownloadArguments = {
	url: string;
	downloadURL: string;
};

function downloadIfNeeded(fileStore: FileStore, url: string, downloadURL: string): OngoingFileAcquisition {
	return fileStore.acquireFileIfNeeded(url, (pendingPath, abortSignal) =>
		fileDownloadLimiter.runWhenFree(
			() => downloadFile(fileStore, abortSignal, pendingPath, downloadURL),
		),
	);
}

export type DownloadTransactionFunction = <T>(
	abortSignal: AbortSignal,
	files: DownloadArguments[],
	transactionCallback: () => T
) => Promise<Awaited<T>>;

export function getDownloadTransactionFunction(
	db: DatabaseConnection,
	fileStore: FileStore | undefined,
): DownloadTransactionFunction {
	return function doDownloadTransaction<T>(
		abortSignal: AbortSignal,
		files: DownloadArguments[],
		transactionCallback: () => T,
	): Promise<Awaited<T>> {
		if (fileStore !== undefined) {
			return fileStore.doFileTransaction(
				abortSignal,
				files.map(({ url, downloadURL }) => downloadIfNeeded(fileStore, url, downloadURL)),
				transactionCallback,
			);
		} else {
			if (files.length !== 0) {
				throw new Error("Trying to download files without a file store");
			}
			return db.transaction(transactionCallback);
		}
	};
}

function stripQuery(url: string) {
	const i = url.indexOf("?");
	return i === -1 ? url : url.slice(0, i);
}
export function normalizeURL(url: string): string {
	if (url.startsWith("https://cdn.discordapp.com/attachments/")) url = stripQuery(url);
	return url;
}

export function getCDNHashURL(prefix: string, hash: string, imageOptions: ImageOptions, animatedImageOptions: AnimatedImageOptions = imageOptions): string {
	const options = hash.startsWith("a_") ? animatedImageOptions : imageOptions;
	return `https://cdn.discordapp.com${prefix}/${hash}.${options.format}?${options.queryParams}`;
}
export function getCDNEmojiURL(emoji: PartialCustomEmoji, imageOptions: ImageOptions, animatedImageOptions: AnimatedImageOptions): string {
	const options = emoji.animated ? animatedImageOptions : imageOptions;
	return `https://cdn.discordapp.com/emojis/${emoji.id}.${options.format}?${options.queryParams}`;
}
