let promiseWithResolvers: <T>() => { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: any) => void };

if ("withResolvers" in Promise) {
	// @ts-expect-error
	promiseWithResolvers = Promise.withResolvers.bind(Promise);
} else {
	promiseWithResolvers = function withResolvers<T>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: any) => void } {
		let resolve!: (value: T | PromiseLike<T>) => void;
		let reject!: (reason?: any) => void;
		const promise = new Promise<T>((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return { promise, resolve, reject };
	};
}

export { promiseWithResolvers };
