import EventEmitter from "node:events";
import type * as http from "node:http";
import * as DT from "../types.js";
import WebSocket from "ws";
import { ClientMessageEncoder, GatewayCompression, GatewayEncoding, getClientMessageEncoder, getServerMessageDecoder, ServerMessageDecoder } from "./encoding.js";
import { RateLimiter } from "../../util/rate-limiter.js";

export type BotGatewayTypes = {
	identifyData: Omit<DT.GatewayIdentifyPayloadBot["d"], "compress">;
	sendPayload: DT.GatewaySendPayload;
	receivePayload: DT.GatewayReceivePayload;
};
export type UserGatewayTypes = BotGatewayTypes;
export type GatewayTypes = BotGatewayTypes;

export type ResumeState = {
	url: string;
	sessionID: string;
	seq: number;
};

const enum ConnectionState {
	Connecting,
	Identifying,
	Ready,
	Destroyed,
}

export class GatewayCloseError extends Error {
	code: number;
	reason: Buffer | undefined;

	constructor(code: number, reason?: Buffer) {
		super(`WebSocket connection closed with code ${code} (${reason ? reason.toString("utf-8") : "no reason given"}).`);
		this.code = code;
		this.reason = reason;
	}
}
GatewayCloseError.prototype.name = "GatewayCloseError";

export class GatewayConnection<GT extends GatewayTypes = GatewayTypes> extends EventEmitter {
	#url: URL;
	#compression: GatewayCompression;
	#encoding: GatewayEncoding;
	#identifyData: GT["identifyData"];
	#headers: http.OutgoingHttpHeaders | undefined;
	#reidentify: boolean;

	#ws: WebSocket | undefined;

	#decodePayload: ServerMessageDecoder<GT["receivePayload"]> | undefined;
	#encodePayload: ClientMessageEncoder<GT["sendPayload"]> | undefined;

	#resumeState: ResumeState | undefined;
	#state: ConnectionState = ConnectionState.Connecting;
	// false if the server is replaying missed events after resuming
	#live = true;
	#wasHeartbeatAcknowledged = true;
	#heartbeatTimer: NodeJS.Timeout | undefined;

	#sendPayloadRateLimiter: RateLimiter | undefined;

	getResumeState(): ResumeState {
		return Object.assign({}, this.#resumeState);
	}

	/**
	 * Handles the authentication and connection to the gateway.
	 *
	 * @param identifyData The data to send in the IDENTIFY payload.
	 * @param resumeState Information to use for resuming a session.
	 * @param compression The compression method to request the server to use. Defaults to `"zlib-stream"`.
	 * @param encoding The encoding to request the server to use. Defaults to `"etf"`.
	 * @param headers The HTTP headers to use in the request.
	 * @param reidentify Whether to start a new session when the old one can't be resumed.
	 */
	constructor({
		identifyData,
		resumeState,
		bot,
		compression,
		encoding,
		headers,
		reidentify,
	}: {
		identifyData: GT["identifyData"];
		resumeState?: ResumeState | undefined;
		bot?: boolean | undefined;
		compression?: GatewayCompression | undefined;
		encoding?: GatewayEncoding | undefined;
		headers?: http.OutgoingHttpHeaders | undefined;
		reidentify?: boolean | undefined;
	}) {
		super();

		bot ??= true;
		this.#compression = compression ?? "zlib-stream";
		this.#encoding = encoding ?? "etf";
		this.#identifyData = Object.assign(identifyData, { compress: false });
		this.#resumeState = resumeState === undefined ? undefined : Object.assign({}, resumeState);
		this.#url = this.#addURLParams(resumeState?.url ?? "wss://gateway.discord.gg/");
		this.#headers = headers;
		this.#reidentify = reidentify ?? true;

		process.nextTick(() => {
			this.#connect();
		});
	}

	#error(error: Error) {
		this.emit("error", error);
		this.#disconnect(4000);
	}

	#addURLParams(url: string) {
		const parsedURL = new URL(url);
		parsedURL.searchParams.set("v", "9");
		if (this.#compression !== "") {
			parsedURL.searchParams.set("compress", this.#compression);
		}
		parsedURL.searchParams.set("encoding", this.#encoding);
		return parsedURL;
	}

	async #connect() {
		if (this.#state === ConnectionState.Destroyed) return;

		this.emit("connecting");
		this.#state = ConnectionState.Connecting;
		this.#wasHeartbeatAcknowledged = true;
		this.#sendPayloadRateLimiter = new RateLimiter(120, 60_000);

		[this.#decodePayload, this.#encodePayload] = await Promise.all([
			getServerMessageDecoder(this.#encoding, this.#compression),
			getClientMessageEncoder(this.#encoding),
		]);

		const ws = new WebSocket(this.#url, { headers: this.#headers });
		this.#ws = ws;
		ws.on("message", (data, isBinary) => {
			if (this.#state === ConnectionState.Destroyed) {
				return;
			}
			const buffer =
				data instanceof Array ? Buffer.concat(data) :
				data instanceof ArrayBuffer ? Buffer.from(data) :
				data;
			let payload;
			try {
				payload = this.#decodePayload!(isBinary ? buffer : buffer.toString("utf-8"));
			} catch (err) {
				this.emit("decodingError", buffer, err);
				this.#reconnect(1000);
				return;
			}
			if (payload !== undefined) {
				this.#onPayload(payload);
			}
		});
		ws.once("close", (code, reason) => {
			if (ws === this.#ws) {
				this.#onClose(code, reason);
			}
		});
		ws.once("error", (err) => {
			this.emit("wsError", err);
		});
	}
	#disconnect(code: number) {
		this.#stopHeartbeating();
		this.#ws?.close(code);
		this.#ws = undefined;
	}
	#reconnect(code: number) {
		this.#disconnect(code);
		this.#connect();
	}

	#onClose(code: number, reason?: Buffer) {
		if (code < 4000 || (code >= 4000 && code < 4010 && code !== 4004)) {
			this.#stopHeartbeating();
			if (this.#ws !== undefined && this.#state !== ConnectionState.Destroyed) {
				this.emit("connectionLost", this.#state !== ConnectionState.Connecting, code, reason?.toString("utf-8"));
				setTimeout(() => {
					this.#connect();
				}, 1000);
			}
			this.#ws = undefined;
			this.#sendPayloadRateLimiter = undefined;
		} else {
			this.#error(new GatewayCloseError(code, reason));
		}
	}

	#onPayload(payload: GT["receivePayload"]) {
		this.emit("payloadReceived", payload);
		if (this.#state === ConnectionState.Destroyed) return;
		switch (payload.op) {
			case DT.GatewayOpcode.Dispatch:
				if (payload.t === "READY") {
					this.#state = ConnectionState.Ready;
					this.#resumeState = {
						url: payload.d.resume_gateway_url,
						sessionID: payload.d.session_id,
						seq: 0,
					};
				}
				if (this.#resumeState === undefined) {
					this.#error(new Error("The first dispatched event was not the READY event."));
					return;
				}
				this.#resumeState.seq = payload.s;
				this.emit("dispatch", payload satisfies DT.GatewayDispatchPayload, this.#live);
				if (payload.t === "RESUMED") {
					this.#live = true;
				}
				break;

			case DT.GatewayOpcode.Hello: {
				if (this.#state !== ConnectionState.Connecting) {
					this.#error(new Error("Got hello opcode twice."));
				}

				this.#startHeartbeating(payload.d.heartbeat_interval);
				this.#resumeOrIdentify();
				break;
			}

			case DT.GatewayOpcode.Heartbeat:
				this.#sendHeartbeat();
				break;

			case DT.GatewayOpcode.HeartbeatACK:
				this.#wasHeartbeatAcknowledged = true;
				break;

			case DT.GatewayOpcode.InvalidSession:
				if (!payload.d) {
					this.emit("sessionLost");
					this.#resumeState = undefined;
					if (this.#reidentify) {
						this.#resumeOrIdentify();
					} else {
						this.destroy();
					}
				} else {
					this.#resumeOrIdentify();
				}
				break;

			case DT.GatewayOpcode.Reconnect:
				this.#reconnect(4000);
				break;
		}
	}

	async #sendPayload(payload: DT.GatewaySendPayload) {
		await this.#sendPayloadRateLimiter!.whenFree();
		if (this.#state === ConnectionState.Destroyed) return;
		// BUG: We need a queue because we can get disconnected while waiting for the rate limiter.
		this.emit("payloadSent", payload);
		this.#ws!.send(this.#encodePayload!(payload));
	}
	async sendPayload(payload: DT.GatewaySendPayload): Promise<void> {
		if (this.#state !== ConnectionState.Ready || this.#ws === undefined) {
			return;
		}
		this.#sendPayload(payload);
	}

	#sendHeartbeat() {
		this.#sendPayload({
			op: DT.GatewayOpcode.Heartbeat,
			d: this.#resumeState?.seq ?? 0,
		});
	}
	#startHeartbeating(interval: number) {
		const handler = () => {
			if (this.#wasHeartbeatAcknowledged) {
				this.#heartbeatTimer = setTimeout(handler, interval);
				this.#wasHeartbeatAcknowledged = false;
				this.#sendHeartbeat();
			} else {
				this.#heartbeatTimer = undefined;
				this.#reconnect(4000);
			}
		};
		this.#heartbeatTimer = setTimeout(handler, interval * Math.random());
	}
	#stopHeartbeating() {
		clearTimeout(this.#heartbeatTimer);
	}

	#resumeOrIdentify() {
		this.#state = ConnectionState.Identifying;
		if (this.#resumeState === undefined) {
			this.#live = true;
			this.#sendPayload({
				op: DT.GatewayOpcode.Identify,
				d: this.#identifyData,
			});
		} else {
			this.#live = false;
			this.#sendPayload({
				op: DT.GatewayOpcode.Resume,
				d: {
					token: this.#identifyData.token,
					session_id: this.#resumeState.sessionID,
					seq: this.#resumeState.seq,
				},
			});
		}
	}

	destroy(): void {
		this.#disconnect(1000);
		this.#state = ConnectionState.Destroyed;
	}
}
