import { workerData, parentPort } from "node:worker_threads";
import { SqliteError } from "better-sqlite3";
import { IteratorRequest, IteratorResponseFor, RequestType, ResponseFor, SingleRequest } from "./types.js";
import { getRequestHandler } from "./request-handler.js";
import { LoggingLevel } from "../util/log.js";

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
export type WorkerSingleResponseMessage<R extends ResponseFor<SingleRequest>> = {
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
	args: unknown[];
};
export type WorkerMessage =
	WorkerReadyMessage |
	WorkerSingleResponseMessage<ResponseFor<SingleRequest>> |
	WorkerIteratorResponseMessage<IteratorResult<IteratorResponseFor<IteratorRequest>>> |
	WorkerErrorMessage |
	WorkerLogMessage;


if (!parentPort) {
	throw new Error("This script should not be imported directly.");
}

process.on("uncaughtExceptionMonitor", (err) => {
	console.error(err);
});

function logMessage(...args: unknown[]) {
	parentPort!.postMessage({
		type: WorkerMessageType.Log,
		args,
	} satisfies WorkerLogMessage);
}

const requestHandler = getRequestHandler({
	path: workerData.path,
	log: {
		log: logMessage,
		maxLevelNumber: workerData.maxLevelNumber,
		setLevel: undefined as any,
		error: workerData.maxLevelNumber >= LoggingLevel.Error ? logMessage : undefined,
		warning: workerData.maxLevelNumber >= LoggingLevel.Warning ? logMessage : undefined,
		info: workerData.maxLevelNumber >= LoggingLevel.Info ? logMessage : undefined,
		verbose: workerData.maxLevelNumber >= LoggingLevel.Verbose ? logMessage : undefined,
		debug: workerData.maxLevelNumber >= LoggingLevel.Debug ? logMessage : undefined,
	},
});

function messageHandler(req: SingleRequest | IteratorRequest) {
	try {
		const resp = requestHandler(req);
		if (req.type === RequestType.Close) {
			parentPort!.off("message", messageHandler);
			return;
		}
		if (typeof resp === "object" && resp !== null && Symbol.iterator in resp) {
			// Implement support for cancellation (return()) if needed
			while (true) {
				const result = resp.next();
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
