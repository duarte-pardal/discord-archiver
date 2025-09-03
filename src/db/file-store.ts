/** @fileoverview Handles the storage of deduplicated file content. */

// The file store is the directory structure that contains downloaded files. Each file is
// identified by the hash of its content, to prevent wasting space with duplicate files.
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
import * as path from "node:path";
import { Logger } from "../util/log.js";
import { DatabaseConnection, RequestType } from "../db/index.js";
import { abortError } from "../util/abort.js";

export type PendingFileResult =
	{
		errorCode: number;
	} |
	{
		errorCode: null;
		hash: Buffer;
		/** Whether the output pending file was created and needs to be removed or settled */
		createdFile: boolean;
	};

export type PendingFile = {
	/**
	 * Idempotent. Should be called inside of a DB transaction.
	 */
	writeToDB(): void;
	/** Should be called when the DB transaction finishes. Commits the file transaction. */
	settle(): Promise<void>;
};
export type OngoingFileAcquisition = {
	/** Promise that resolves when the acquisition finishes */
	readonly promise: Promise<PendingFile>;
	/** Used by a caller to indicate that it's not interested in the result. Each caller must not call `abort()` more than once. */
	readonly abort: () => Promise<void>;
};
type InternalOngoingFileAcquisition = OngoingFileAcquisition & {
	/** Count of how many callers are interested in the result. Incremented when the function is called. */
	refCount: number;
	/** Promise that resolves when the file acquisition is aborted. `undefined` if it hasn't been aborted yet. */
	abortPromise: Promise<void> | undefined;
};

const savedPendingFile: PendingFile = {
	writeToDB() {},
	async settle() {},
};

type ConsistencyCheckResult = {
	missingFiles: Set<string>;
	extraFiles: Set<string>;
};


export class FileStore {
	readonly #basePath: string;
	readonly #db: DatabaseConnection;
	log: Logger | undefined;

	#pendingFileNames = new Set<string>();

	/**
	 * Maps the URLs of downloaded files which haven't been written to the database yet to the
	 * respective promises.
	 *
	 * This is needed to prevent the file at the same URL from being downloaded multiple times.
	 */
	#ongoingAcquisitions = new Map<string, InternalOngoingFileAcquisition>();

	constructor(basePath: string, db: DatabaseConnection, log?: Logger) {
		// Remove trailing slash and normalize
		this.#basePath = path.dirname(path.join(basePath, "a"));
		this.#db = db;
		this.log = log;
	}

	/**
	 * Initializes the file store directory structure if needed and moves pending files which finished
	 * downloading. */
	async open(readOnly = false): Promise<void> {
		const pendingDirPath = `${this.#basePath}/pending`;
		try {
			await fs.promises.mkdir(this.#basePath);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
				throw err;
			}
		}
		if (!readOnly) {
			try {
				await fs.promises.mkdir(pendingDirPath);
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
					throw err;
				}
			}
		}

		let pendingFiles;
		try {
			pendingFiles = await fs.promises.readdir(pendingDirPath);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				return;
			} else {
				throw err;
			}
		}

		// For each pending file, calculate its hash and check if it is in the database.
		for (const name of pendingFiles) {
			await new Promise<void>((res, rej) => {
				const hasher = crypto.createHash("sha256");
				const pendingFilePath = `${pendingDirPath}/${name}`;
				const readStream = fs.createReadStream(pendingFilePath);
				readStream.once("error", (err) => {
					readStream.close();
					rej(err);
				});
				readStream.pipe(hasher, { end: true });
				hasher.once("readable", () => {
					res((async () => {
						const hash = hasher.read();
						const hashUsed = await this.#db.request({
							type: RequestType.GetFileHashUtilization,
							hash,
						});
						const stringifiedHash = hash.toString("base64url");
						if (hashUsed) {
							this.log?.verbose?.(`Settling pending file with hash ${stringifiedHash}.`);
							await fs.promises.rename(pendingFilePath, `${this.#basePath}/${stringifiedHash}`);
						} else {
							this.log?.verbose?.(`Removing incomplete pending file with hash ${stringifiedHash}.`);
							try {
								await fs.promises.unlink(pendingFilePath);
							} catch {}
						}
					})());
				});
			});
		}
	}

	async close(): Promise<void> {
		const ongoingAcquisitions = [...this.#ongoingAcquisitions.values()];
		if (ongoingAcquisitions.some(a => a.abortPromise === undefined)) {
			throw new Error("Can't close the file store while there are ongoing file acquisitions, except for those that are aborting.");
		}
		await Promise.allSettled(ongoingAcquisitions.map(a => a.abortPromise));
		if (this.#ongoingAcquisitions.size !== 0 || this.#pendingFileNames.size !== 0) {
			this.log?.warning?.("Debug warning (please report): Possible memory leak in the file store.");
			this.log?.debug?.("ongoingAcquisitions: %o\npendingFileNames: %o", this.#ongoingAcquisitions, this.#pendingFileNames);
		}
		try {
			await fs.promises.rmdir(`${this.#basePath}/pending`);
		} catch (err) {
			this.log?.warning?.(`Couldn't remove the file store's pending directory (${(err as NodeJS.ErrnoException).message}). There's no loss of data. Check the directory for extra files not created by this program.`);
		}
	}

	async checkConsistency(deleteExtraFiles = false): Promise<ConsistencyCheckResult> {
		const [hashesInDB, filesInFileStore] = await Promise.all([
			(async () => {
				const hashesInDB = new Set<string>();
				for await (const { hash } of this.#db.iteratorRequest({ type: RequestType.GetFiles })) {
					if (hash !== null) {
						hashesInDB.add(Buffer.from(hash).toString("base64url"));
					}
				}
				return hashesInDB;
			})(),
			(async () =>
				new Set(await fs.promises.readdir(this.#basePath))
			)(),
		]);

		const missingFiles = hashesInDB.difference(filesInFileStore);
		const extraFiles = filesInFileStore.difference(hashesInDB);

		if (deleteExtraFiles) {
			await Promise.all(extraFiles.values().map(hash => fs.promises.unlink(`${this.#basePath}/${hash}`)));
		}

		return {
			missingFiles,
			extraFiles,
		};
	}

	getBasePath(): string {
		return this.#basePath;
	}
	#generatePendingFileName(): string {
		let pendingFileName;
		let n = Math.floor(Math.random() * 0x100000000);
		do {
			pendingFileName = n.toString(16).padStart(8, "0");
			n++;
		} while (this.#pendingFileNames.has(pendingFileName));
		this.#pendingFileNames.add(pendingFileName);
		return pendingFileName;
	}
	getPendingPath(pendingFileName: string): string {
		return `${this.#basePath}/pending/${pendingFileName}`;
	}
	getHashedPath(hash: Buffer): string {
		return `${this.#basePath}/${hash.toString("base64url")}`;
	}

	async removeFile(pendingPath: string): Promise<void> {
		try {
			await fs.promises.unlink(pendingPath);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				this.log?.debug?.(`Couldn't remove pending file ${pendingPath} because it doesn't exist.`);
				return;
			} else {
				throw err;
			}
		}
	}
	async settleFile(pendingPath: string, hash: Buffer): Promise<void> {
		this.log?.debug?.(`Settling file ${pendingPath} -> ${hash.toString("base64url")}`);
		// The rename operation sometimes throws EPERM on Windows. If that happens, try again.
		for (let i = 0; ; i++) {
			try {
				await fs.promises.rename(pendingPath, `${this.#basePath}/${hash.toString("base64url")}`);
				break;
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code !== "EPERM" || i === 2) {
					throw err;
				}
			}
		}
	}

	/**
	 * Checks if the file, identified by its URL, has been stored in the database yet. If not,
	 * calls the callback. The callback should create a new file with the given file name.
	 * The promise returned by the callback should resolve if and only if the entire file was
	 * written to storage.
	 */
	acquireFileIfNeeded(
		url: string,
		callback: (pendingFileName: string, abortSignal: AbortSignal) => Promise<PendingFileResult>,
	): OngoingFileAcquisition {
		let ongoingAcquisition: InternalOngoingFileAcquisition | undefined = this.#ongoingAcquisitions.get(url);

		if (ongoingAcquisition !== undefined) {
			ongoingAcquisition.refCount++;
		} else {
			const childController = new AbortController();

			/** Will be set when the file is downloaded. */
			let fileInfo: PendingFileResult | undefined;
			/** Will be set when a caller calls settle. */
			let settlePromise: Promise<void> | undefined;
			const pendingFileName = this.#generatePendingFileName();
			const pendingFilePath = this.getPendingPath(pendingFileName);

			const actuallyAbort = async () => {
				if (settlePromise !== undefined)
					throw new Error("Trying to abort file operation after settling");

				// Actually abort
				if (fileInfo === undefined) {
					this.log?.debug?.(`All callers aborted the acquisition of <${url}>. Aborting the request.`);

					childController.abort();

					try {
						await ongoingAcquisition!.promise;
					} catch {}
				}
				if (fileInfo !== undefined && fileInfo.errorCode === null && fileInfo.createdFile) {
					// The file was completely written to storage and wasn't deleted. This usually happens when
					// the abort is requested after the acquisition promise resolves but it might also
					// happen when the abort is requested before the acquisition promise resolves, in which
					// case the previous `if` statement is also executed.

					this.log?.debug?.(`All callers aborted the acquisition of <${url}>. Removing the file.`);
					try {
						await this.removeFile(pendingFilePath);
					} catch {}
				}
				this.#ongoingAcquisitions.delete(url);
				this.#pendingFileNames.delete(pendingFileName);
				this.log?.debug?.(`Completed abort of the acquisition of <${url}>.`);
			};

			// The file will only be removed if all callers call `abort()`.
			const abort = async () => {
				ongoingAcquisition!.refCount--;
				if (ongoingAcquisition!.refCount < 0)
					throw new Error("File reference count is less than 0 on abort");

				// If there are more callers still waiting for the file, don't abort.
				if (ongoingAcquisition!.refCount !== 0) {
					this.log?.debug?.(`A caller aborted the acquisition of <${url}>. The reference count is now ${ongoingAcquisition!.refCount}.`);
					return; // Resolve immediately for this caller
				}

				const abortPromise = actuallyAbort();
				ongoingAcquisition!.abortPromise = abortPromise;
				await abortPromise;
			};

			const promise = (async (): Promise<PendingFile> => {
				// The database will only be checked if the URL is not in `this.#ongoingAcquisitions`, that is, if
				// the file is either not downloaded or downloaded and in the database.
				if (
					await this.#db.request({
						type: RequestType.GetFile,
						url,
					}) !== undefined
				) {
					// This file is already in the database
					this.#ongoingAcquisitions.delete(url);
					this.#pendingFileNames.delete(pendingFileName);
					return savedPendingFile;
				}

				// The code below should only run once per file URL throughout the entire program lifetime.

				try {
					fileInfo = await callback(pendingFilePath, childController.signal);
				} catch (err) {
					this.#ongoingAcquisitions.delete(url);
					this.#pendingFileNames.delete(pendingFileName);
					throw err;
				}

				return {
					writeToDB: () => {
						if (fileInfo!.errorCode !== null) {
							this.#db.request({
								type: RequestType.AddFile,
								url,
								errorCode: fileInfo!.errorCode,
								hash: null,
							});
						} else {
							this.#db.request({
								type: RequestType.AddFile,
								url,
								errorCode: null,
								hash: fileInfo!.hash,
							});
						}
					},
					settle: async () => {
						if (settlePromise !== undefined)
							return settlePromise;

						settlePromise = (async () => {
							if (fileInfo!.errorCode === null && fileInfo!.createdFile) {
								await this.settleFile(pendingFilePath, fileInfo!.hash);
							}
						})();

						try {
							await settlePromise;
						} finally {
							this.#ongoingAcquisitions.delete(url);
							this.#pendingFileNames.delete(pendingFileName);
						}
					},
				};
			})();

			ongoingAcquisition = {
				abort,
				promise: promise,
				refCount: 1,
				abortPromise: undefined,
			};
			this.#ongoingAcquisitions.set(url, ongoingAcquisition);
		}

		this.log?.debug?.(`Reference count for <${url}> increased to ${ongoingAcquisition.refCount}.`);
		return ongoingAcquisition;
	}

	async doFileTransaction<T>(abortSignal: AbortSignal, operations: OngoingFileAcquisition[], transactionCallback: () => T): Promise<Awaited<T>> {
		let abortPromises: Promise<void>[] | undefined;
		function abortAll() {
			abortPromises = operations.map(o => o.abort());
		}
		if (abortSignal.aborted) {
			abortAll();
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

		try {
			return await this.#db.transaction(async () => {
				for (const file of files) {
					file.writeToDB();
				}
				return await transactionCallback();
			});
		} finally {
			// Move the new unique files to the main directory after the information
			// is stored in the database.
			await Promise.all(files.map(file => file.settle()));
		}
	}
}
