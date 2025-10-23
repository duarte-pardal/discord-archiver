import { abortError, preventUnsettled } from "../util/abort.js";
import { timeout } from "../util/abort.js";
import { ConcurrencyLimiter } from "../util/concurrency-limiter.js";
import { isFetchAbortError } from "../util/http.js";
import log from "../util/log.js";
import { RateLimiter } from "../util/rate-limiter.js";

// Yes, I'm aware that the latest version is 10. I'm using v9 because it's what the stable Discord
// client uses and I'm planning on adding support for user accounts.
const API_ROOT = "https://discord.com/api/v9";

export class DiscordAPIError extends Error {
	statusCode: number;
	errorData: { message: string } | undefined;

	constructor(statusCode: number, errorData?: { message: string }) {
		super(errorData?.message ?? `Got status ${statusCode}`);
		this.statusCode = statusCode;
		this.errorData = errorData;
	}
}

export type RequestResult<T> = {
	response: Response;
	data: T | undefined;
};

/** The top-level resources the per-route rate limits are applied to. */
export const enum RateLimitRoute {
	GetUser,
	GetEmojis,
	GetArchivedThreads,
	GetMessages,
	GetReactions,
}
export type ParameterlessRateLimitRoutes = RateLimitRoute.GetUser | RateLimitRoute.GetArchivedThreads;

export type RestOptions = {
	/** Should include the token in the headers, if needed. */
	fetchOptions?: RequestInit;
} & (
	{
		rateLimitRoute: Exclude<RateLimitRoute, ParameterlessRateLimitRoutes>;
		rateLimitID: string;
	} |
	{
		rateLimitRoute: ParameterlessRateLimitRoutes;
		rateLimitID?: never;
	}
);

type RateLimitInstance = {
	resetTimestamp: number;
	limiter: ConcurrencyLimiter;
};

/** Manages HTTP requests to the REST API for one account. */
export class RestManager {
	#globalRateLimiter = new RateLimiter(50, 1000);
	#rateLimitInstances: Record<RateLimitRoute, Map<string, RateLimitInstance>> & Map<string, RateLimitInstance>[] = [new Map(), new Map(), new Map(), new Map(), new Map()];

	async request<T>(endpoint: string, options: RestOptions): Promise<RequestResult<T>> {
		const abortSignal = options.fetchOptions?.signal;
		const topResourceKey = options.rateLimitID ?? "";
		log.debug?.(`Requesting ${endpoint}`);
		let interval = 0;
		const request = new Request(API_ROOT + endpoint, options.fetchOptions);
		while (true) {
			try {
				await this.#globalRateLimiter.whenFree(abortSignal);

				let instance: RateLimitInstance | undefined;
				instance = this.#rateLimitInstances[options.rateLimitRoute].get(topResourceKey);
				if (instance === undefined) {
					instance = {
						resetTimestamp: 0,
						limiter: new ConcurrencyLimiter(1),
					};
					this.#rateLimitInstances[options.rateLimitRoute].set(topResourceKey, instance);
				}

				const cleanup = () => {
					if (instance.limiter.getQueueSize() === 0) {
						this.#rateLimitInstances[options.rateLimitRoute].delete(topResourceKey);
					}
					abortSignal?.removeEventListener("abort", cleanup);
				};
				abortSignal?.addEventListener("abort", cleanup);

				let ret: RequestResult<T> | undefined;
				await instance.limiter.runWhenFree(async () => {
					try {
						const response = await preventUnsettled(abortSignal, "REST/fetch()", fetch(request));

						if (response.headers.get("X-RateLimit-Remaining") === "0") {
							const resetTimestamp = Date.now() + Number.parseFloat(response.headers.get("X-RateLimit-Reset-After")!) * 1000;
							if (!Number.isNaN(resetTimestamp)) {
								instance.resetTimestamp = resetTimestamp;
							}
						}

						if (response.status === 429) {
							const scope = response.headers.get("X-RateLimit-Scope");
							if (scope !== "shared") {
								log.warning?.(`Unexpectedly exceeded ${scope === "user" ? "the per-route" : scope === "global" ? "the global" : "an unknown"} rate limit while requesting ${request.method} ${request.url} (bucket ${response.headers.get("X-RateLimit-Bucket")}).`);
							}
							let retryAfter: number | undefined = undefined;
							try {
								const data = await preventUnsettled(abortSignal, "REST/response.json()", response.json());
								if (
									typeof data === "object" &&
									data !== null &&
									"retry_after" in data &&
									typeof data.retry_after === "number"
								) {
									retryAfter = data.retry_after * 1000;
								}
							} catch {}
							interval = retryAfter ?? Math.max(interval, 2_000);

						} else if (response.status >= 500 && response.status < 600) {
							log.warning?.(`Got unexpected server error (HTTP ${response.status} ${response.statusText}) while requesting ${request.method} ${request.url}. Retrying.`);

						} else {
							let json: any = undefined;
							try {
								json = await preventUnsettled(abortSignal, "REST/response.json()", response.json()) as T;
							} catch (err) {
								if (!((err instanceof SyntaxError) && !response.ok)) {
									throw err; // Will be caught by the outer try catch statement.
								}
								// JSON parsing errors from unsuccessful responses are ignored.
							}
							log.debug?.(`Got response from ${endpoint}: ${response.status} ${response.statusText} %o %o`, response.headers, json);
							ret = {
								response,
								data: response.ok ? json : undefined,
							};
						}
					} finally {
						const now = Date.now();
						if (instance.resetTimestamp > now) {
							await timeout(instance.resetTimestamp - now, abortSignal);
						}
						cleanup();
					}
				}, abortSignal);
				if (ret !== undefined) {
					return ret;
				}
			} catch (err) {
				if (isFetchAbortError(err)) {
					throw abortError;
				} else if (err instanceof TypeError) {
					log.warning?.(`Network error while requesting ${request.method} ${request.url}: ${err.message}`);
				} else {
					throw err;
				}
			}
			if (abortSignal?.aborted) {
				throw abortError;
			}
			await timeout(interval, abortSignal);
			interval = Math.min(interval + 2_000, 60_000);
		}
	}
}
