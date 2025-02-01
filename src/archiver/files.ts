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
import { ConcurrencyLimiter } from "../util/concurrency-limiter.js";

const EXTENSION_REGEX = /\.[\w-]{1,20}$/;
const ACCEPT_BYTE_RANGES_REGEX = /(?:,|^)\s*bytes\s*(?:,|$)/;
// TODO: Switch to BLAKE2b 256 (implemented in Bun but not in Node.js)

/**
 * Initializes the file store directory structure if needed and moves pending files which finished
 * downloading. */
export async function openFileStore(fileStorePath: string, db: DatabaseConnection): Promise<void> {
	// Also creates the main file store dir.
	const pendingDirPath = `${fileStorePath}/pending`;
	await fs.promises.mkdir(pendingDirPath, { recursive: true });

	// For each pending file, calculate its hash and check if it is in the database.
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
		log.warning?.(`WARNING: Couldn't remove the file store's pending directory (${(err as NodeJS.ErrnoException).message}). This is a bug but there's no loss of data. Check the directory for extra files not created by this program.`);
	}
}


export type PendingFileInfo =
	{
		errorCode: number;
	} |
	{
		errorCode: null;
		hash: Buffer;
		temporaryPath: string | null;
		extension: string;
	};

/** Unconditionally downloads a file to disk. The file on disk is deleted if there's another file with the same content. */
export async function downloadFile(fileStorePath: string, downloadURL: string, abortSignal: AbortSignal): Promise<PendingFileInfo> {
	if (abortSignal.aborted) {
		throw abortError;
	}

	const parsedURL = new URL(downloadURL);

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
	let errorCode;
	try {
		if (abortSignal.aborted as boolean) {
			throw abortError;
		}
		log.debug?.(`Requesting the file at <${downloadURL}> (${temporaryName}).`);

		// Retry the request if it failed
		while (true) {
			// This looks dumb but it's the simplest way of distinguishing the sources of errors.
			let errorContext: "none" | "fetch" | "fs" = "none";

			try {
				errorContext = "fetch";
				const response = await fetch(downloadURL, {
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
					log.warning?.(`Got HTTP ${response.status} ${response.statusText} response while requesting the file at <${downloadURL}>. Retrying.`);
					for await (const _chunk of response.body ?? []) {
						// Consume the body to prevent leaking resources
					}
				} else if (!response.ok) {
					// Impossible to download file
					log.debug?.(`Got HTTP ${response.status} ${response.statusText} while requesting the file at <${downloadURL}>.`);
					errorCode = response.status < 0 ? 0 : response.status;
					for await (const _chunk of response.body ?? []) {
						// Consume the body to prevent leaking resources
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
						log.warning?.(`Got unexpected combination HTTP ${response.status} ${response.statusText} and Content-Range: ${contentRange} while requesting the file at <${downloadURL}>. This file will not be archived.`);
						errorCode = -1;
						for await (const _chunk of response.body ?? []) {
							// Consume the body to prevent leaking resources
						}
						break;
					}

					if (response.body === null) {
						log.warning?.(`Response body is null for <${downloadURL}>.`);
						errorCode = -1;
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
		log.debug?.(`The request for the file at <${downloadURL}> (${temporaryName}) was aborted or failed with an unexpected error.`);
		await file.close();
		await fs.promises.unlink(temporaryPath);
		throw err;
	}

	if (errorCode !== null) {
		// Recoverable error
		log.debug?.(`The request for the file at <${downloadURL}> (${temporaryName}) failed with error code ${errorCode}.`);
		await file.close();
		await fs.promises.unlink(temporaryPath);
		return {
			errorCode,
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
			log.debug?.(`There's a stored file equal to the file at <${downloadURL}> with hash ${hash.toString("base64url")}.`);
			await fs.promises.unlink(temporaryPath);
			return {
				errorCode: null,
				hash,
				temporaryPath: null,
				extension,
			};
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
				throw err;
			}
			// No equal file exists

			log.debug?.(`The file at <${downloadURL}> (${temporaryName}) with hash ${hash.toString("base64url")} is unique and will be stored.`);
			return {
				errorCode: null,
				hash,
				temporaryPath,
				extension,
			};
		}
	}
}

export async function removeFile(temporaryPath: string): Promise<void> {
	await fs.promises.unlink(temporaryPath);
}

export async function settleFile(fileStorePath: string, temporaryPath: string, hash: Buffer): Promise<void> {
	log.debug?.(`Settling file ${temporaryPath} -> ${hash.toString("base64url")}`);
	await fs.promises.rename(temporaryPath, `${fileStorePath}/${hash.toString("base64url")}`);
}

export type PendingFile = {
	/**
	 * Should be called inside of a transaction. This runs an `INSERT OR IGNORE` statement, so
	 * it's idempotent.
	 */
	writeToDB(): void;
	/** Should be called when the transaction finishes. */
	settle(): Promise<void>;
};

const fileDownloadLimiter = new ConcurrencyLimiter(80);

export type CurrentDownload = {
	/** Promise that resolves when the download finishes */
	promise: Promise<PendingFile>;
	/** Used by a caller to indicate that it's not interested in the result. Each caller must not call `abort()` more than once. */
	abort: () => Promise<void>;
	/** Count of how many callers are interested in the result. Incremented when the function is called  */
	refCount: number;
};
/**
 * Maps the URLs of downloaded files which haven't been written to the database yet to the
 * respective promises.
 *
 * This is needed to prevent the file at the same URL from being downloaded multiple times.
 */
const downloadingFiles = new Map<string, CurrentDownload>();

const savedPendingFile: PendingFile = {
	writeToDB() {},
	async settle() {},
};

export type DownloadContext = {
	fileStorePath: string;
	db: DatabaseConnection;
	abortSignal: AbortSignal;
};

export function downloadFileIfNeeded(fileStorePath: string, db: DatabaseConnection, url: string, downloadURL: string): CurrentDownload {
	let currentDownload: CurrentDownload | undefined = downloadingFiles.get(url);

	if (currentDownload !== undefined) {
		currentDownload.refCount++;
	} else {
		const childController = new AbortController();

		/** Will be set when the file is downloaded. */
		let fileInfo: PendingFileInfo | undefined;
		/** Will be set when a caller calls settle. */
		let settlePromise: Promise<void> | undefined;

		// The file will only be removed if all callers call `abort()`.
		async function abort() {
			currentDownload!.refCount--;
			if (currentDownload!.refCount < 0)
				throw new Error("File reference count is less than 0 on abort");

			// If there are more callers still waiting for the file, don't abort.
			if (currentDownload!.refCount !== 0) {
				log.debug?.(`A caller aborted the download of <${url}>. The reference count is now ${currentDownload!.refCount}.`);
				return; // Resolve immediately for this caller
			}

			if (settlePromise !== undefined)
				throw new Error("Trying to abort file operation after settling");

			// Actually abort
			if (fileInfo === undefined) {
				log.debug?.(`All callers aborted the download of <${url}>. Aborting the request.`);

				childController.abort();

				try {
					await currentDownload!.promise;
				} catch {}
			}
			if (fileInfo !== undefined && fileInfo.errorCode === null && fileInfo.temporaryPath !== null) {
				// The file was completely downloaded and wasn't deleted. This usually happens when
				// the abort is requested after the download promise resolves but it might also
				// happen when the abort is requested before the download promise resolves, in which
				// case the previous `if` statement also executed.

				log.debug?.(`All callers aborted the download of <${url}>. Removing the file.`);
				await removeFile(fileInfo.temporaryPath);
			}
			downloadingFiles.delete(url);
		}

		const promise = (async (): Promise<PendingFile> => {
			// The database will only be checked if the URL is not in `downloadingFiles`, that is, if
			// the file is either not downloaded or downloaded and in the database.
			if (
				await db.request({
					type: RequestType.GetFile,
					url,
				}) !== undefined
			) {
				// This file is already in the database
				downloadingFiles.delete(url);
				return savedPendingFile;
			}

			// The code below should only run once per file URL throughout the entire program lifetime.

			try {
				fileInfo = await fileDownloadLimiter.runWhenFree(
					() => downloadFile(fileStorePath, downloadURL, childController.signal),
				);
			} catch (err) {
				downloadingFiles.delete(url);
				throw err;
			}

			return {
				writeToDB() {
					if (fileInfo!.errorCode !== null) {
						db.request({
							type: RequestType.AddFile,
							url,
							errorCode: fileInfo!.errorCode,
							hash: null,
						});
					} else {
						db.request({
							type: RequestType.AddFile,
							url,
							errorCode: null,
							hash: fileInfo!.hash,
						});
					}
				},
				async settle() {
					if (settlePromise !== undefined)
						return settlePromise;
					downloadingFiles.delete(url);
					settlePromise = (async () => {
						if (fileInfo!.errorCode === null && fileInfo!.temporaryPath !== null) {
							await settleFile(fileStorePath, fileInfo!.temporaryPath, fileInfo!.hash);
						}
					})();
				},
			};
		})();

		currentDownload = {
			abort,
			promise: promise,
			refCount: 1,
		};
		downloadingFiles.set(url, currentDownload);
	}

	log.debug?.(`Reference count for <${url}> increased to ${currentDownload.refCount}.`);
	return currentDownload;
}

export type DownloadInfo = {
	url: string;
	downloadURL: string;
};

export async function performFileTransaction(
	fileStorePath: string,
	db: DatabaseConnection,
	abortSignal: AbortSignal,
	operations: CurrentDownload[],
	transactionCallback: () => Promise<void>,
): Promise<void> {
	let abortPromises: Promise<void>[] | undefined;
	function abortAll() {
		abortPromises = operations.map(o => o.abort());
	}
	abortSignal.addEventListener("abort", abortAll, { once: true });
	let files;
	try {
		files = await Promise.all(operations.map(o => o.promise));
	} finally {
		abortSignal.removeEventListener("abort", abortAll);
	}

	if (abortPromises !== undefined) {
		await Promise.all(abortPromises);
		throw abortError;
	}

	await db.transaction(async () => {
		if (abortSignal.aborted) {
			throw abortError;
		}
		for (const file of files) {
			file.writeToDB();
		}
		await transactionCallback();
	});

	// Move the new unique files to the main directory after the information
	// is stored in the database.
	await Promise.all(files.map(file => file.settle()));
}
