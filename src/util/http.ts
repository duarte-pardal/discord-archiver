export function isFetchAbortError(err: unknown): boolean {
	// For some reason, undici sometimes throws abort events instead of errors.
	return (err instanceof DOMException && err.name === "AbortError") || (err instanceof Event && err.type === "abort");
}

export function mergeOptions(target: RequestInit, source: RequestInit): RequestInit {
	const output = Object.assign(Object.assign({}, target), source);
	const sourceHeaders = source.headers ? new Headers(source.headers) : undefined;
	if (sourceHeaders) {
		const headers = target.headers ? new Headers(target.headers) : new Headers();
		sourceHeaders.forEach((v, k) => {
			headers.set(k, v);
		});
		output.headers = headers;
	}
	return output;
}
