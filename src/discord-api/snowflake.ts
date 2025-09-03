export function snowflakeToTimestamp(snowflake: bigint): bigint {
	return (snowflake >> 22n) + 1420070400000n;
}
