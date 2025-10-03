import { GatewayConnection, GatewayTypes } from "../discord-api/gateway/connection.js";
import { CachedGuild, CachedTextLikeChannel, CachedThread } from "./cache.js";
import { RequestResult } from "../discord-api/rest.js";

export type OngoingOperationBase = {
	abortController?: AbortController;
	end?: Promise<void>;
	account: Account;
};
export type OngoingMessageSync = OngoingOperationBase & {
	abortController: AbortController;
	channel: CachedTextLikeChannel | CachedThread;
};
export type OngoingThreadSync = OngoingOperationBase & {
	abortController: AbortController;
	channel: CachedTextLikeChannel | CachedThread;
};
export type OngoingExpressionUploaderRequest = OngoingOperationBase & {
	abortController: AbortController;
	guild: CachedGuild;
};
export type OngoingMemberListSync = OngoingOperationBase & {
	guild: CachedGuild;
	memberIDs: Set<bigint>;
};
export type OngoingDispatchHandling = OngoingOperationBase & {
	abortController: AbortController;
};
export type OngoingOperation =
	OngoingMessageSync |
	OngoingThreadSync |
	OngoingExpressionUploaderRequest |
	OngoingMemberListSync |
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
	ongoingMemberSyncs: Set<OngoingMemberListSync>;
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
