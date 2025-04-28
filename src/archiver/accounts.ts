import { GatewayConnection, GatewayTypes } from "../discord-api/gateway/connection.js";
import { CachedTextLikeChannel, CachedThread } from "./cache.js";
import { RequestResult } from "../discord-api/rest.js";

export type OngoingOperation = {
	abortController: AbortController;
	end: Promise<void>;
};
export type OngoingMessageSync = OngoingOperation & {
	channel: CachedTextLikeChannel | CachedThread;
};

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
	/** For channels and its public threads */
	ongoingMessageSyncs: Map<CachedTextLikeChannel, Map<string /* the channel/thread ID */, OngoingMessageSync>>;
	/** For private threads */
	ongoingPrivateThreadMessageSyncs: Map<CachedTextLikeChannel, Map<string /* the thread ID */, OngoingMessageSync>>;
	ongoingPublicThreadListSyncs: Map<CachedTextLikeChannel, OngoingOperation>;
	ongoingPrivateThreadListSyncs: Map<CachedTextLikeChannel, OngoingOperation>;
	ongoingJoinedPrivateThreadListSyncs: Map<CachedTextLikeChannel, OngoingOperation>;
	ongoingExpressionUploaderRequests: Set<OngoingOperation>;

	numberOfOngoingGatewayOperations: number;
	/** Set of guild IDs */
	ongoingMemberRequests: Set<string>;

	ongoingDispatchHandlers: Set<OngoingOperation>;

	/** The sets and maps that contain entries with this account as the key, used when disconnecting the account */
	references: Set<Set<Account> | Map<Account, unknown>>;
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
