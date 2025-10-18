import { FileStore } from "../db/file-store.js";
import { snowflakeToTimestamp } from "../discord-api/snowflake.js";
import { setProgress } from "../util/progress-display.js";
import { accounts, OngoingDispatchHandling, OngoingMessageSync } from "./accounts.js";

let active = false;
let fileStore: FileStore | undefined;

let nextUpdateTimestamp: number | null = null;
let updateTimer: NodeJS.Timeout | null = null;

export function startProgressDisplay(store: FileStore | undefined): void {
	active = true;
	fileStore = store;
}
export function stopProgressDisplay(): void {
	active = false;
	setProgress();
	if (updateTimer !== null) {
		clearTimeout(updateTimer);
	}
}

let filesDownloaded = 0;
let bytesDownloaded = 0;
let duplicateFilesDownloaded = 0;
let duplicateBytesDownloaded = 0;
export function onFileDownload(bytes: number, duplicate: boolean): void {
	if (duplicate) {
		duplicateFilesDownloaded++;
		duplicateBytesDownloaded += bytes;
	} else {
		filesDownloaded++;
		bytesDownloaded += bytes;
	}
	updateProgressOutput();
}

let messagesArchived = 0;
export function onArchiveMessages(count: number): void {
	messagesArchived += count;
	updateProgressOutput();
}

function pad2(n: number): string {
	return n.toString().padStart(2, "0");
}
function dateToLocalTimestamp(date: Date): string {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function updateProgressOutput(): void {
	if (!active) return;

	// Debounce updates
	const now = Date.now();
	if (updateTimer !== null) return;
	if (nextUpdateTimestamp !== null && now - nextUpdateTimestamp < 0) {
		updateTimer = setTimeout(() => {
			updateTimer = null;
			updateProgressOutput();
		}, nextUpdateTimestamp - now);
		return;
	}
	nextUpdateTimestamp = now + 50;

	const messageSyncs: OngoingMessageSync[] = [];
	const dispatchHandlings: OngoingDispatchHandling[] = [];
	let otherSyncCount = 0;
	for (const operation of
		accounts
			.values()
			.map(a => [a.ongoingOperations, a.ongoingMemberSyncs])
			.flatMap(x => x)
			.flatMap(x => x)
	) {
		if (operation.type === "message-sync") {
			messageSyncs.push(operation);
		} else if (operation.type === "dispatch-handling") {
			dispatchHandlings.push(operation);
		} else {
			otherSyncCount++;
		}
	}
	const hiddenSyncCount = otherSyncCount + (messageSyncs.length - Math.min(messageSyncs.length, 10));

	const topMessageSyncs = messageSyncs
		.sort((a, b) =>
			a.progress === null ? -1 :
			b.progress === null ? 1 :
			a.progress - b.progress,
		)
		.slice(0, 10);
	let maxChannelNameLength = 0;
	for (const sync of topMessageSyncs) {
		if (sync.channel.name.length > maxChannelNameLength) {
			maxChannelNameLength = sync.channel.name.length;
		}
	}

	const output = (new Array<string>()).concat(
		topMessageSyncs.map((sync) => (
			("#" + (sync.channel.name + " ").slice(0, maxChannelNameLength).padEnd(maxChannelNameLength, ".")) +
			"  " +
			(sync.progress === null ?
				"   [unknown progress]   " :
				(
					Math.floor((sync.progress * 10000) / 100).toFixed(2).padStart(5, " ") + "%" +
					sync.archivedMessageCount.toFixed(0).padStart(7, " ") + " / " + ("~" + sync.totalMessageCount!.toFixed(0)).padStart(8, " ")
				)
			) +
			(
				sync.channel.lastSyncedMessageID === undefined || sync.channel.lastSyncedMessageID === 0n ?
					"" :
					"  " + dateToLocalTimestamp(new Date(Number(snowflakeToTimestamp(sync.channel.lastSyncedMessageID))))
			)
		)),
		dispatchHandlings.map(op => `Handling ${op.eventName} dispatch from ${op.account.name}.`),
		hiddenSyncCount === 0 ? [] : [`+${hiddenSyncCount} other operations`],
	).join("\n");

	setProgress(`\n\
${output !== "" ? output : "Nothing left to sync."}
Archived ${messagesArchived} messages.\
${fileStore === undefined ? "" : `\nDownloaded ${filesDownloaded} files (${bytesDownloaded >> 20} MiB). Ignored ${duplicateFilesDownloaded} duplicates (${duplicateBytesDownloaded >> 20} MiB).`}`,
	);
}
