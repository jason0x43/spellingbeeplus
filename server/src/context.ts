import type { WSContext } from "hono/ws";
import type { Db } from "./db";
import type { Client, PlayerId } from "./types";
import { getEnv } from "./util.js";

export class Context {
	#version: number;
	#apiKey: string;
	#clients: Map<PlayerId, Client>;
	#connections: Map<WSContext<WebSocket>, PlayerId>;
	#tokens: Map<string, Date>;
	#db: Db;

	constructor(db: Db) {
		this.#apiKey = getEnv("API_KEY");
		this.#clients = new Map();
		this.#connections = new Map();
		this.#tokens = new Map();
		this.#version = Number(Date.now());
		this.#db = db;
	}

	get version() {
		return this.#version;
	}

	get apiKey() {
		return this.#apiKey;
	}

	get clients() {
		return this.#clients;
	}

	get connections() {
		return this.#connections;
	}

	get tokens() {
		return this.#tokens;
	}

	get db() {
		return this.#db;
	}
}
