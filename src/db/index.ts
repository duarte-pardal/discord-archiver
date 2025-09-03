import { Worker } from "node:worker_threads";
import { IteratorRequest, IteratorResponseFor, SingleRequest } from "./types.js";
import { ConcurrencyLimiter } from "../util/concurrency-limiter.js";
import { RequestType, SingleResponseFor } from "./types.js";
import { WorkerMessage, WorkerMessageType } from "./worker.js";
import { RequestHandler } from "./request-handler.js";
import log from "../util/log.js";

type BaseDatabaseConnection = {
	errored: boolean;
	error: unknown;
	ready: Promise<void>;

	request<R extends SingleRequest>(req: R): Promise<SingleResponseFor<R>>;
	iteratorRequest<R extends IteratorRequest>(req: R): AsyncIterableIterator<IteratorResponseFor<R>>;
	transaction<T>(callback: () => T): Promise<Awaited<T>>;
	close(): Promise<void>;
};

type SingleQueueItem = {
	type: "single";
	res: (res?: any) => void;
	rej: (error: unknown) => void;
};
type IteratorQueueItem = {
	type: "iterator";
	resultQueue: IteratorResult<any>[];
	res: ((result: IteratorResult<IteratorResponseFor<IteratorRequest>>) => void) | undefined;
	rej: ((error: unknown) => void) | undefined;
	errored: boolean;
	error: unknown;
};
type QueueItem = SingleQueueItem | IteratorQueueItem;

class AsyncDatabaseConnection implements BaseDatabaseConnection {
	#worker: Worker;
	#queue: QueueItem[] = [];
	errored = false;
	error: unknown;
	ready: Promise<void>;
	#readyCallbacks: { res: () => void; rej: (error: unknown) => void } | undefined;
	#transactionLimiter = new ConcurrencyLimiter(1);

	constructor(path: string) {
		this.ready = new Promise((res, rej) => {
			this.#readyCallbacks = { res, rej };
		});
		this.#worker = new Worker(new URL("./worker.js", import.meta.url), {
			workerData: {
				path,
				maxLevelNumber: log.maxLevelNumber,
			},
		});
		this.#worker.on("message", (msg: WorkerMessage) => {
			if (msg.type === WorkerMessageType.Log) {
				log[msg.level]?.(...msg.args);
			} else if (msg.type === WorkerMessageType.Ready) {
				this.#readyCallbacks!.res();
			} else if (this.#queue[0].type === "iterator") {
				// We are currently receiving the results from an iterator request
				const item = this.#queue[0];
				if (msg.type === WorkerMessageType.Error) {
					item.errored = true;
					item.error = msg.error;
					if (item.rej !== undefined) {
						item.rej(msg.error);
						item.res = undefined;
						item.rej = undefined;
					}
					this.#queue.shift();
				} else if (msg.type === WorkerMessageType.IteratorResponse) {
					if (item.res !== undefined) {
						item.res(msg.result);
						item.res = undefined;
						item.rej = undefined;
					} else {
						item.resultQueue.push(msg.result);
					}
					if (msg.result.done) {
						this.#queue.shift();
					}
				} else {
					throw new TypeError("Got invalid response from worker.");
				}
			} else {
				// We were waiting for the response from a single request
				if (msg.type === WorkerMessageType.Error) {
					(this.#queue.shift() as SingleQueueItem).rej(msg.error);
				} else if (msg.type === WorkerMessageType.SingleResponse) {
					(this.#queue.shift() as SingleQueueItem).res(msg.response);
				} else {
					throw new TypeError("Got invalid response from worker.");
				}
			}
		});
		this.#worker.on("exit", () => {
			if (!this.errored) {
				// Resolve the close request.
				(this.#queue.shift() as SingleQueueItem).res();

				// Reject all requests made after the close request.
				this.error = new Error("The database connection was closed.");
				this.errored = true;
				for (const { rej } of this.#queue) {
					rej?.(this.error);
				}
				this.#queue.length = 0;
			}
		});
		this.#worker.on("error", (error) => {
			// Reject all requests.
			this.error = error;
			this.errored = true;
			this.#readyCallbacks?.rej(error);
			for (const { rej } of this.#queue) {
				rej?.(error);
			}
			this.#queue.length = 0;
		});
	}

	request<R extends SingleRequest>(req: R): Promise<SingleResponseFor<R>> {
		return new Promise((res, rej) => {
			if (this.errored) {
				rej(this.error);
			} else {
				this.#queue.push({ type: "single", res, rej });
				this.#worker.postMessage(req);
			}
		});
	}

	iteratorRequest<R extends IteratorRequest>(req: R): AsyncIterableIterator<IteratorResponseFor<R>> {
		if (this.errored) {
			return {
				next: () => {
					return Promise.reject(this.error);
				},
				[Symbol.asyncIterator]() {
					return this;
				},
			};
		} else {
			this.#worker.postMessage(req);
			const item: IteratorQueueItem = {
				type: "iterator",
				resultQueue: [],
				res: undefined,
				rej: undefined,
				errored: false,
				error: undefined,
			};
			this.#queue.push(item);
			return {
				next: () => {
					return new Promise((res, rej) => {
						if (item.errored) {
							rej(item.error);
						} else if (item.resultQueue.length > 0) {
							res(item.resultQueue.shift()!);
						} else if (item.res !== undefined) {
							throw new Error("next() was called multiple times between results");
						} else {
							item.res = res as (result: IteratorResult<IteratorResponseFor<IteratorRequest>>) => void;
							item.rej = rej;
						}
					});
				},
				[Symbol.asyncIterator]() {
					return this;
				},
			};
		}
	}

	transaction<T>(callback: () => T): Promise<Awaited<T>> {
		return this.#transactionLimiter.runWhenFree(async (): Promise<Awaited<T>> => {
			this.request({ type: RequestType.BeginTransaction });
			try {
				const ret = await callback();
				this.request({ type: RequestType.CommitTransaction });
				return ret;
			} catch (err) {
				this.request({ type: RequestType.RollbackTransaction });
				throw err;
			}
		});
	}

	close(): Promise<void> {
		return this.#transactionLimiter.runWhenFree(async () => {
			this.request({ type: RequestType.Close });
		});
	}
}

class SyncDatabaseConnection implements BaseDatabaseConnection {
	errored = false;
	error = undefined;
	ready = Promise.resolve();

	#requestHandler: RequestHandler;
	#transactionLimiter = new ConcurrencyLimiter(1);

	constructor(requestHandler: RequestHandler) {
		this.#requestHandler = requestHandler;
	}

	requestSync<R extends SingleRequest>(req: R): SingleResponseFor<R> {
		return this.#requestHandler(req);
	}
	async request<R extends SingleRequest>(req: R): Promise<SingleResponseFor<R>> {
		return this.requestSync(req);
	}

	iteratorRequestSync<R extends IteratorRequest>(req: R): IterableIterator<IteratorResponseFor<R>> {
		return this.#requestHandler(req);
	}
	async *iteratorRequest<R extends IteratorRequest>(req: R): AsyncIterableIterator<IteratorResponseFor<R>> {
		yield* this.iteratorRequestSync(req);
	}

	transaction<T>(callback: () => T): Promise<Awaited<T>> {
		return this.#transactionLimiter.runWhenFree(async (): Promise<Awaited<T>> => {
			this.requestSync({ type: RequestType.BeginTransaction });
			const ret = await callback();
			this.requestSync({ type: RequestType.CommitTransaction });
			return ret;
		});
	}

	close(): Promise<void> {
		return this.#transactionLimiter.runWhenFree(async () => {
			this.request({ type: RequestType.Close });
		});
	}
}

export type DatabaseConnection = AsyncDatabaseConnection | SyncDatabaseConnection;

export async function getDatabaseConnection(path: string, synchronous?: false): Promise<AsyncDatabaseConnection>;
export async function getDatabaseConnection(path: string, synchronous: true): Promise<SyncDatabaseConnection>;
export async function getDatabaseConnection(path: string, synchronous: boolean): Promise<DatabaseConnection>;
export async function getDatabaseConnection(path: string, synchronous = false): Promise<DatabaseConnection> {
	if (synchronous) {
		const requestHandler = (await import("./request-handler.js")).getRequestHandler({
			path,
			log,
		});
		return new SyncDatabaseConnection(requestHandler);
	} else {
		return new AsyncDatabaseConnection(path);
	}
}

export * from "./types.js";
