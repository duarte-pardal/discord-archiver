import { setProgress } from "../util/progress-display.js";
import { CachedChannel, ThreadInfo } from "./cache.js";

export type MessageSyncProgress = {
	progress: number | null;
	channel: CachedChannel | ThreadInfo;
};
export type ArchivedThreadSyncProgress = {
	progress: null;
	channel: CachedChannel | ThreadInfo;
};
// TODO: Add member list sync progress
export type SyncProgress = MessageSyncProgress | ArchivedThreadSyncProgress;
export const downloadProgresses = new Set<SyncProgress>();
export const progressCounts = {
	messageSyncs: 0,
	threadEnumerations: 0,
	messagesArchived: 0,
};

let active = false;
export function startProgressDisplay(): void {
	active = true;
}
export function stopProgressDisplay(): void {
	active = false;
	setProgress();
}

export function updateProgressOutput(): void {
	if (!active) return;

	let min: SyncProgress = { progress: Infinity } as MessageSyncProgress;
	for (const progress of downloadProgresses) {
		if (progress.progress !== null && progress.progress < min.progress!) {
			min = progress;
		}
	}
	if (min.progress === Infinity && downloadProgresses.size > 0) {
		min = (downloadProgresses.values().next() as IteratorYieldResult<SyncProgress>).value;
	}
	if (min.progress === Infinity) {
		setProgress("Nothing to sync.");
	} else {
		setProgress(`\
${progressCounts.messageSyncs === 0 ? "" : `Downloading messages in ${progressCounts.messageSyncs} channels. `}\
${progressCounts.threadEnumerations === 0 ? "" : `Enumerating archived threads in ${progressCounts.threadEnumerations} channels. `}\
${progressCounts.messagesArchived} messages archived in this session.
${min.progress === null ? "" : ((min.progress * 100).toFixed(2) + "% ")}${min.channel.parent ? "thread" : min.channel.guild?.name ?? "dm"} #${min.channel.name}`);
	}
}
