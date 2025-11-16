function stripQuery(url: string) {
	const i = url.indexOf("?");
	return i === -1 ? url : url.slice(0, i);
}
export function normalizeURL(url: string): string {
	if (
		url.startsWith("https://cdn.discordapp.com/attachments/") ||
		url.startsWith("https://media.discordapp.net/attachments/")
	) {
		url = stripQuery(url);
	}
	return url;
}
