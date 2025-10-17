import { snowflakeToTimestamp } from "../discord-api/snowflake.js";
import { setProgress } from "../util/progress-display.js";
import { accounts, OngoingDispatchHandling, OngoingMessageSync } from "./accounts.js";

let active = false;
export function startProgressDisplay(): void {
	active = true;
}
export function stopProgressDisplay(): void {
	active = false;
	setProgress();
}

function pad2(n: number): string {
	return n.toString().padStart(2, "0");
}
function dateToLocalTimestamp(date: Date): string {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function updateProgressOutput(): void {
	if (!active) return;

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
		.filter(s => s.progress != null)
		.sort((a, b) => a.progress! - b.progress!)
		.slice(0, 10);
	let maxChannelNameLength = 0;
	for (const sync of topMessageSyncs) {
		if (sync.channel.name.length > maxChannelNameLength) {
			maxChannelNameLength = sync.channel.name.length;
		}
	}

	const output = (new Array<string>()).concat(
		topMessageSyncs.map((sync) => {
			return `\
#${sync.channel.name.padEnd(maxChannelNameLength, ".")} \
${sync.progress === null ? "" : ((sync.progress * 100).toFixed(2) + "%")}\
${sync.totalMessageCount === null ? "" : ` = ${sync.archivedMessageCount.toFixed(0).padStart(7, " ")} / ${("~" + sync.totalMessageCount.toFixed(0)).padStart(8, " ")}`}\
${sync.channel.lastSyncedMessageID === undefined || sync.channel.lastSyncedMessageID === 0n ? "" : "  " + dateToLocalTimestamp(new Date(Number(snowflakeToTimestamp(sync.channel.lastSyncedMessageID))))}`;
		}),
		dispatchHandlings.map(op => `Handling ${op.eventName} dispatch from ${op.account.name}.`),
		hiddenSyncCount === 0 ? [] : [`+${hiddenSyncCount} other operations`],
	).join("\n");

	setProgress("\n" + (output !== "" ? output : "Nothing left to sync."));
}
