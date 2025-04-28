import { PartialCustomEmoji } from "./types.js";

const EMOJI_REGEX = /<(a?):([^:]*):(\d+)>/g;
export function extractEmojis(content: string): PartialCustomEmoji[] {
	const emojis: PartialCustomEmoji[] = [];
	for (const match of content.matchAll(EMOJI_REGEX)) {
		emojis.push({
			animated: match[1] !== "",
			name: match[2],
			id: match[3],
		});
	}
	return emojis;
}
