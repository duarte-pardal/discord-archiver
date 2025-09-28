import { workerData, parentPort } from "node:worker_threads";
import { SqliteError } from "better-sqlite3";
import { IteratorRequest, IteratorResponseFor, RequestType, SingleResponseFor, SingleRequest } from "./types.js";
import { getRequestHandler } from "./request-handler.js";
import { LevelName, LoggingLevel } from "../util/log.js";

export const enum WorkerMessageType {
	Ready,
	SingleResponse,
	IteratorResponse,
	Error,
	Log,
}

export type WorkerReadyMessage = {
	type: WorkerMessageType.Ready;
};
export type WorkerSingleResponseMessage<R extends SingleResponseFor<SingleRequest>> = {
	type: WorkerMessageType.SingleResponse;
	response: R;
};
export type WorkerIteratorResponseMessage<R extends IteratorResult<IteratorResponseFor<IteratorRequest>>> = {
	type: WorkerMessageType.IteratorResponse;
	result: R;
};
export type WorkerErrorMessage = {
	type: WorkerMessageType.Error;
	error: unknown;
};
export type WorkerLogMessage = {
	type: WorkerMessageType.Log;
	level: LevelName;
	args: unknown[];
};
export type WorkerMessage =
	WorkerReadyMessage |
	WorkerSingleResponseMessage<SingleResponseFor<SingleRequest>> |
	WorkerIteratorResponseMessage<IteratorResult<IteratorResponseFor<IteratorRequest>>> |
	WorkerErrorMessage |
	WorkerLogMessage;


if (!parentPort) {
	throw new Error("This script should not be imported directly.");
}

process.on("uncaughtExceptionMonitor", (err) => {
	console.error(err);
});

function logMessage(level: LevelName, ...args: unknown[]) {
	parentPort!.postMessage({
		type: WorkerMessageType.Log,
		level,
		args,
	} satisfies WorkerLogMessage);
}

const requestHandler = getRequestHandler({
	path: workerData.path,
	log: {
		log: undefined as any,
		maxLevelNumber: workerData.maxLevelNumber,
		setLevel: undefined as any,
		error: workerData.maxLevelNumber >= LoggingLevel.Error ? logMessage.bind(null, "error") : undefined,
		warning: workerData.maxLevelNumber >= LoggingLevel.Warning ? logMessage.bind(null, "warning") : undefined,
		info: workerData.maxLevelNumber >= LoggingLevel.Info ? logMessage.bind(null, "info") : undefined,
		verbose: workerData.maxLevelNumber >= LoggingLevel.Verbose ? logMessage.bind(null, "verbose") : undefined,
		debug: workerData.maxLevelNumber >= LoggingLevel.Debug ? logMessage.bind(null, "debug") : undefined,
	},
});

function messageHandler(req: SingleRequest | IteratorRequest) {
	try {
		const resp = requestHandler(req);
		if (req.type === RequestType.Close) {
			parentPort!.off("message", messageHandler);
			return;
		}
		if (typeof resp === "object" && (resp as typeof resp | null) !== null && Symbol.iterator in resp) {
			const iterator = resp[Symbol.iterator]();
			while (true) {
				let result;
				try {
					result = iterator.next();
				} catch (err) {
					iterator.return?.();
					throw err;
				}
				parentPort!.postMessage({
					type: WorkerMessageType.IteratorResponse,
					result,
				} satisfies WorkerIteratorResponseMessage<any>);
				if (result.done) break;
			}
		} else {
			parentPort!.postMessage({
				type: WorkerMessageType.SingleResponse,
				response: resp,
			} satisfies WorkerSingleResponseMessage<any>);
		}
	} catch (error) {
		let newError: any = error;
		if (error instanceof SqliteError) {
			newError = new Error(`SQLite error (${error.code}) during request of type ${req.type}: ${error.message}`);
		}
		parentPort!.postMessage({
			type: WorkerMessageType.Error,
			error: newError,
		} satisfies WorkerErrorMessage);
	}
}
parentPort.on("message", messageHandler);

// Indicate to the parent thread that the connection is ready
parentPort.postMessage({ type: WorkerMessageType.Ready } satisfies WorkerReadyMessage);
