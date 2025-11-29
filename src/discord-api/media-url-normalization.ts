function stripQuery(url: string) {
	const i = url.indexOf("?");
	return i === -1 ? url : url.slice(0, i);
}

/** Normalizes a Discord attachment URL. */
// This function is used to transform a real URL into the URL used for identifying files and to
// determine whether two snapshots are equal. (Message snapshots are equal if the embed URLs are
// equal after normalization.)
export function normalizeURL(url: string): string {
	if (
		url.startsWith("https://cdn.discordapp.com/attachments/") ||
		url.startsWith("https://media.discordapp.net/attachments/")
	) {
		url = stripQuery(url);
	}
	return url;
}
