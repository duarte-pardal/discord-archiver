export function createOnceFunction<T>(object: T): (key: string) => T | undefined {
	const keys = new Set<string>();
	return (name: string) => {
		if (!keys.has(name)) {
			keys.add(name);
			return object;
		}
	};
}
