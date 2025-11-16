export function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
	const length = a.length;
	if (b.length !== length) return false;
	for (let i = 0; i < length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}
