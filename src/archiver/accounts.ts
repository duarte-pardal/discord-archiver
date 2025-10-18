import { GatewayConnection, GatewayTypes } from "../discord-api/gateway/connection.js";
import { CachedGuild, CachedTextLikeChannel, CachedThread } from "./cache.js";
import { RequestResult } from "../discord-api/rest.js";
import { DispatchEventName } from "../discord-api/types.js";

export type OngoingOperationBase = {
	abortController?: AbortController;
	end?: Promise<void>;
	account: Account;
};
export type OngoingMessageSync = OngoingOperationBase & {
	type: "message-sync";
	abortController: AbortController;
	channel: CachedTextLikeChannel | CachedThread;
	/** The number of messages archived by this sync operation. */
	archivedMessageCount: number;
	/**
	 * The estimated number of messages from the message this operation started syncing from until
	 * the last message in the channel.
	 */
	totalMessageCount: number | null;
	/**
	 * The estimated progress of the operation as a fraction where `0` corresponds to the start of
	 * the operation and `1` corresponds to having archived all messages in the channel.
	 */
	progress: number | null;
};
export type OngoingThreadSync = OngoingOperationBase & {
	type: "thread-sync";
	abortController: AbortController;
	channel: CachedTextLikeChannel | CachedThread;
};
export type OngoingExpressionUploaderRequest = OngoingOperationBase & {
	type: "expression-uploader-request";
	abortController: AbortController;
	guild: CachedGuild;
};
export type OngoingMemberSync = OngoingOperationBase & {
	type: "member-sync";
	guild: CachedGuild;
	memberIDs: Set<bigint>;
};
export type OngoingDispatchHandling = OngoingOperationBase & {
	type: "dispatch-handling";
	eventName: DispatchEventName;
	abortController: AbortController;
};
export type OngoingOperation =
	OngoingMessageSync |
	OngoingThreadSync |
	OngoingExpressionUploaderRequest |
	OngoingMemberSync |
	OngoingDispatchHandling;

export type AccountOptions = {
	name: string;
	mode: "bot" | "user" | "unsafe-user";
	token: string;
	gatewayIdentifyData: GatewayTypes["identifyData"];
	restHeaders: Record<string, string>;
};
export type Account = AccountOptions & {
	bot: boolean;
	details: {
		id: string;
		tag: string;
	} | undefined;
	gatewayConnection: GatewayConnection;
	restOptions: RequestInit;
	request<T>(endpoint: string, options?: RequestInit, abortIfFail?: boolean): Promise<RequestResult<T>>;

	disconnect: () => Promise<void>;

	numberOfOngoingRESTOperations: number;
	numberOfOngoingGatewayOperations: number;

	ongoingOperations: Set<OngoingOperation>;
	ongoingMemberSyncs: Set<OngoingMemberSync>;
};

export const accounts = new Set<Account>();

export function getLeastRESTOccupiedAccount(iterable: Iterable<Account>): Account | undefined {
	let min: Account | undefined;
	for (const account of iterable) {
		if (min === undefined || account.numberOfOngoingRESTOperations < min.numberOfOngoingRESTOperations) {
			min = account;
		}
	}
	return min;
}
export function getLeastGatewayOccupiedAccount(iterable: Iterable<Account>): Account | undefined {
	let min: Account | undefined;
	for (const account of iterable) {
		if (min === undefined || account.numberOfOngoingGatewayOperations < min.numberOfOngoingGatewayOperations) {
			min = account;
		}
	}
	return min;
}
