import { abortError } from "../util/abort.js";
import { extendAbortSignal, timeout } from "../util/abort.js";
import { isFetchAbortError } from "../util/http.js";
import log from "../util/log.js";

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
	rateLimitReset: Promise<void> | undefined;
};

export async function apiReq<T>(endpoint: string, options?: RequestInit, abortIfFail = false): Promise<RequestResult<T>> {
	log.debug?.(
		`Requesting ${endpoint} %o`,
		options === undefined ?
			undefined :
			Object.fromEntries(Object.entries(options).filter(([k]) => k !== "signal")),
	);
	let interval = 0;
	const { controller, done } = extendAbortSignal(options?.signal);
	const request = new Request(API_ROOT + endpoint, {
		...options,
		signal: controller.signal,
	});
	while (true) {
		try {
			const response = await fetch(request);
			if (response.status === 429) {
				const scope = response.headers.get("X-RateLimit-Scope");
				if (scope !== "shared") {
					log.warning?.(`Unexpectedly exceeded ${scope === "user" ? "the per-route" : scope === "global" ? "the global" : "an unknown"} rate limit while requesting ${request.method} ${request.url}.`);
				}
				let retryAfter: number | undefined = undefined;
				try {
					const data = await response.json();
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
				const rateLimitReset =
					!response.headers.has("X-RateLimit-Remaining") ? undefined :
					response.headers.get("X-RateLimit-Remaining") !== "0" ? Promise.resolve() :
					timeout(Number.parseFloat(response.headers.get("X-RateLimit-Reset-After")!) * 1000, options?.signal);

				let data: T | undefined = undefined;
				if (abortIfFail && !response.ok) {
					log.debug?.(`Got response from ${endpoint}: ${response.status} ${response.statusText} %o [aborted]`, response.headers);
					controller.abort();
				} else {
					if (response.ok) {
						data = await response.json() as T;
						log.debug?.(`Got response from ${endpoint}: ${response.status} ${response.statusText} %o %o`, response.headers, data);
					}
				}
				return { response, data, rateLimitReset };
			}
		} catch (err) {
			if (isFetchAbortError(err)) {
				throw abortError;
			} else if (err instanceof TypeError) {
				log.warning?.(`Network error while requesting ${request.method} ${request.url}: ${err.message}`);
			} else {
				throw err;
			}
		} finally {
			done();
		}
		if (controller.signal.aborted) {
			throw abortError;
		}
		await timeout(interval, options?.signal);
		interval = Math.min(interval + 2_000, 60_000);
	}
}
