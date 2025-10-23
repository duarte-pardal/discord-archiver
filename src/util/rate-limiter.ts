import { abortError } from "./abort.js";

/**
 * Class that handles actions that must happen at most L times every I milliseconds.
 */
export class RateLimiter {
	limit: number;
	interval: number;
	#lastTimestamps: number[] = [];
	#pending = new Set<() => void>();
	#executeFirstPending: () => void;

	constructor(limit: number, interval: number) {
		this.limit = limit;
		this.interval = interval;
		this.#executeFirstPending = () => {
			const now = Date.now();
			this.#lastTimestamps.push(now);
			if (this.#pending.size > 0) {
				const earliestPendingCallback = this.#pending.values().next().value!;
				this.#pending.delete(earliestPendingCallback);
				earliestPendingCallback();
				setTimeout(this.#executeFirstPending, this.#lastTimestamps.shift()! + this.interval - now);
			}
		};
	}

	getPendingAmount(): number {
		return this.#pending.size;
	}

	/**
	 * Returns a promise that only resolves `this.limit` times every `this.interval` milliseconds.
	 * Promises returned from earlier calls will be resolved first.
	 */
	whenFree(abortSignal?: AbortSignal | null): Promise<void> {
		return new Promise((res, rej) => {
			if (abortSignal?.aborted) {
				rej(abortError);
				return;
			}

			const now = Date.now();

			// Cleanup the old timestamps
			while (this.#lastTimestamps.length > 0 && this.#lastTimestamps[0] + this.interval < now) {
				this.#lastTimestamps.shift();
			}

			if (this.#lastTimestamps.length < this.limit && this.#pending.size === 0) {
				// There is time to do it right now.
				this.#lastTimestamps.push(now);
				res();
			} else {
				// We are over the limit; schedule it for later.
				if (this.#pending.size === 0) {
					setTimeout(this.#executeFirstPending, this.#lastTimestamps.shift()! + this.interval - now);
				}
				const callback = () => {
					abortSignal?.removeEventListener("abort", abortHandler);
					res();
				};
				this.#pending.add(callback);
				const abortHandler = () => {
					this.#pending.delete(callback);
					rej(abortError);
				};
				abortSignal?.addEventListener("abort", abortHandler, { once: true });
			}
		});
	}
}
