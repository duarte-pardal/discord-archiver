let text = "";
let lines = 0;

if (process.stdout.isTTY && process.stderr.isTTY) {
	function clear() {
		process.stderr.write(`${lines > 0 ? `\x1B[${lines}A` : ""}\x1B[G\x1B[J`);
	}
	function write() {
		process.stderr.write(text);
	}

	for (const methodName of [
		"count",
		"debug",
		"dir",
		"dirxml",
		"error",
		"info",
		"log",
		"table",
		"timeEnd",
		"timeLog",
		"trace",
		"warn",
	] as const) {
		const oldMethod = console[methodName];
		console[methodName] = function consoleMethod(...args: any[]) {
			clear();
			oldMethod.apply(console, args);
			write();
		};
	}
}

export function setProgress(newText: string | undefined = ""): void {
	if (process.stderr.isTTY) {
		process.stderr.write(`${lines > 0 ? `\x1B[${lines}A` : ""}\x1B[G${newText.replaceAll("\n", "\x1B[K\n")}\x1B[J`);

		text = newText;
		lines = 0;
		for (const char of text) {
			if (char === "\n") lines++;
		}
	} else {
		process.stderr.write(newText + "\n");
	}
}
