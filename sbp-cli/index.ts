import { Command } from "@commander-js/extra-typings";
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { clearLine, createInterface, cursorTo } from "node:readline";
import { z } from "zod";
import {
	GameId,
	GameInfo as GameInfoSchema,
	PlayerId,
} from "../server/src/types.js";
import {
	MessageFrom as MessageFromSchema,
	MessageTo as MessageToSchema,
	isMessageType,
} from "../server/src/message.js";
import type {
	ClientMessageContent,
	MessageFrom,
	ServerMessageContent,
} from "../server/src/message.js";
import type {
	GameId as GameIdType,
	GameInfo,
	NytGameId as NytGameIdType,
	PlayerId as PlayerIdType,
} from "../server/src/types.js";

const TokenResponse = z.object({ token: z.string() });

const program = new Command();

program
	.name("sbp")
	.description("Dev CLI for interacting with the SBP server")
	.configureHelp({ sortSubcommands: true })
	.showHelpAfterError()
	.version("0.1.0");

addServerOptions(program);

program
	.command("ws")
	.description("Connect to the SBP websocket and listen/respond to events")
	.option(
		"--player-id <id>",
		"Player ID to use (negative recommended for CLI)",
		Number,
	)
	.option("--name <name>", "Display name")
	.option("--game-id <id>", "Default internal gameId", Number)
	.option(
		"--auto-accept-sync",
		"Automatically accept incoming sync requests",
		false,
	)
	.option(
		"--auto-reject-sync",
		"Automatically reject incoming sync requests",
		false,
	)
	.option("--no-repl", "Disable interactive prompt")
	.action(async (options) => {
		const config = resolveConfig({ ...program.opts(), ...options });
		if (config.tlsInsecure) {
			setTlsInsecure();
		}

		const store = await createCliStore();

		const playerIdRaw =
			typeof options.playerId === "number" ? options.playerId : store.state.playerId;
		const playerId = PlayerId.parse(playerIdRaw);

		const name = options.name ?? store.state.name ?? "sbp-cli";

		const initialGameIdRaw =
			typeof options.gameId === "number"
				? options.gameId
				: store.state.lastGameId ?? null;
		const initialGameId =
			typeof initialGameIdRaw === "number"
				? GameId.parse(initialGameIdRaw)
				: null;

		await store.update({
			playerId: Number(playerId),
			name,
			lastGameId: initialGameIdRaw,
		});

		const session = await connectSession({
			config,
			playerId,
			name,
			autoAcceptSync: options.autoAcceptSync,
			autoRejectSync: options.autoRejectSync,
			initialGameId,
			lockPath: store.lockPath,
			onActiveGameIdChange: (id) => {
				return store.update({ lastGameId: id ? Number(id) : null });
			},
		});

		console.log(
			`Connected as ${session.playerId} (${session.name}). Type 'help' for commands.`,
		);

		if (!options.repl) {
			await session.waitUntilClosed();
			return;
		}

		await runRepl(session);
	})
	.showHelpAfterError();

const game = program.command("game").description("Interact with synced games");

game
	.command("info")
	.description("Fetch the current state for a synced game")
	.argument("<gameId>", "Internal gameId", Number)
	.action(async (gameId, options) => {
		const config = resolveConfig({ ...program.opts(), ...options });
		if (config.tlsInsecure) {
			setTlsInsecure();
		}

		const info = await getGameInfo({
			config,
			gameId: GameId.parse(gameId),
		});

		console.log(JSON.stringify(info, null, 2));
	});

game
	.command("add")
	.description("Add one or more words to a synced game")
	.argument("<gameId>", "Internal gameId", Number)
	.argument("<word>", "A word to add")
	.argument("[words...]", "More words to add")
	.option(
		"--player-id <id>",
		"Player ID to use (negative recommended for CLI)",
		Number,
	)
	.option("--name <name>", "Display name")
	.action(async (gameId, word, words, options) => {
		const config = resolveConfig({ ...program.opts(), ...options });
		if (config.tlsInsecure) {
			setTlsInsecure();
		}

		const store = await createCliStore();

		const playerIdRaw =
			typeof options.playerId === "number" ? options.playerId : store.state.playerId;
		const playerId = PlayerId.parse(playerIdRaw);
		const name = options.name ?? store.state.name ?? "sbp-cli";
		const internalGameId = GameId.parse(gameId);

		await store.update({
			playerId: Number(playerId),
			name,
			lastGameId: Number(internalGameId),
		});

		const session = await connectSession({
			config,
			playerId,
			name,
			autoAcceptSync: false,
			autoRejectSync: true,
			initialGameId: internalGameId,
			lockPath: store.lockPath,
			onActiveGameIdChange: (id) => {
				return store.update({ lastGameId: id ? Number(id) : null });
			},
		});

		const allWords = [word, ...(words ?? [])]
			.map((w) => String(w).trim())
			.filter(Boolean);
		for (const w of allWords) {
			await session.addWord(w);
			console.log(`Sent addWord(${internalGameId}, ${w})`);
		}

		await session.close();
	});

try {
	await program.parseAsync();
} catch (error) {
	console.error(`Error: ${String(error)}`);
	process.exitCode = 1;
}

function addServerOptions(cmd: Command) {
	return cmd
		.option(
			"--api-host <host>",
			"SBP server host (e.g. localhost:3000 or https://localhost:3000)",
			process.env.SBP_API_HOST ?? "localhost:3000",
		)
		.option(
			"--api-key <key>",
			"SBP API key (defaults to SBP_API_KEY)",
			process.env.SBP_API_KEY,
		)
		.option(
			"--tls-insecure",
			"Disable TLS certificate verification (dev only)",
			process.env.SBP_TLS_INSECURE === "true",
		);
}

const CliStateSchema = z.object({
	playerId: z.number(),
	name: z.string().optional(),
	lastGameId: z.number().nullable().optional(),
});

type CliState = z.infer<typeof CliStateSchema>;

type CliStore = {
	state: CliState;
	lockPath: string;
	update: (patch: Partial<CliState>) => Promise<void>;
};

function resolveCliStateDir(): string {
	const explicit = process.env.SBP_CLI_STATE_DIR;
	if (explicit) {
		return explicit;
	}

	const xdg = process.env.XDG_CONFIG_HOME;
	const base = xdg && xdg.trim() ? xdg.trim() : join(homedir(), ".config");
	return join(base, "sbp-cli");
}

function generatePersistentPlayerId(): number {
	// Negative IDs are reserved for fake/dev players.
	return -randomInt(1, 2_000_000_000);
}

async function createCliStore(): Promise<CliStore> {
	const dir = resolveCliStateDir();
	await mkdir(dir, { recursive: true });

	const statePath = join(dir, "state.json");
	const lockPath = join(dir, "instance.lock");

	let initialState: CliState | null = null;
	try {
		if (existsSync(statePath)) {
			const raw = await readFile(statePath, "utf8");
			const parsed = CliStateSchema.safeParse(JSON.parse(raw));
			if (parsed.success) {
				initialState = {
					playerId: parsed.data.playerId,
					name: parsed.data.name,
					lastGameId: parsed.data.lastGameId ?? null,
				};
			}
		}
	} catch {
		// Fall through to initialization.
	}

	if (!initialState) {
		initialState = { playerId: generatePersistentPlayerId(), lastGameId: null };
		await writeFile(statePath, JSON.stringify(initialState, null, 2) + "\n", "utf8");
	}

	const state = initialState;

	let writeChain: Promise<void> = Promise.resolve();
	const update = async (patch: Partial<CliState>) => {
		Object.assign(state, patch);
		writeChain = writeChain.then(async () => {
			await mkdir(dirname(statePath), { recursive: true });
			await writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
		});
		await writeChain;
	};

	return { state, lockPath, update };
}

async function acquireInstanceLock(lockPath: string): Promise<() => Promise<void>> {
	await mkdir(dirname(lockPath), { recursive: true });

	while (true) {
		try {
			const file = await open(lockPath, "wx");
			try {
				await file.writeFile(`${process.pid}\n`, "utf8");
			} finally {
				await file.close();
			}

			let released = false;
			return async () => {
				if (released) {
					return;
				}
				released = true;
				await unlink(lockPath).catch(() => undefined);
			};
		} catch (error) {
			if (!(error instanceof Error)) {
				throw error;
			}

			const code = (error as NodeJS.ErrnoException).code;
			if (code !== "EEXIST") {
				throw error;
			}

			let existingPid: number | null = null;
			try {
				const raw = await readFile(lockPath, "utf8");
				const parsed = Number(raw.trim());
				existingPid = Number.isFinite(parsed) ? parsed : null;
			} catch {
				// ignore
			}

			if (existingPid) {
				try {
					process.kill(existingPid, 0);
					throw new Error(
						`sbp-cli is already running (pid=${existingPid}). Use the existing session instead of opening a second connection.`,
					);
				} catch (err) {
					const killCode = (err as NodeJS.ErrnoException)?.code;
					if (killCode !== "ESRCH") {
						throw err;
					}
				}
			}

			// Stale lock; remove and retry.
			await unlink(lockPath).catch(() => undefined);
		}
	}
}

function setTlsInsecure() {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

type CliConfig = {
	apiKey: string;
	apiHost: string;
	tlsInsecure: boolean;
};

function asString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

function asBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function resolveConfig(options: Record<string, unknown>): CliConfig {
	const apiHost =
		asString(options.apiHost) ??
		asString(process.env.SBP_API_HOST) ??
		"localhost:3000";
	const apiKey =
		asString(options.apiKey) ??
		asString(process.env.SBP_API_KEY) ??
		asString(process.env.API_KEY);
	if (!apiKey) {
		throw new Error(
			"Missing API key (set SBP_API_KEY/API_KEY or pass --api-key)",
		);
	}
	return {
		apiHost,
		apiKey,
		tlsInsecure: asBoolean(options.tlsInsecure) ?? false,
	};
}

function resolveBaseUrl(apiHost: string): URL {
	if (/^https?:\/\//.test(apiHost)) {
		return new URL(apiHost);
	}
	return new URL(`https://${apiHost}`);
}

async function getToken(config: CliConfig): Promise<string> {
	const baseUrl = resolveBaseUrl(config.apiHost);
	const url = new URL("/token", baseUrl);
	const resp = await fetch(url, {
		method: "GET",
		headers: {
			"x-api-key": config.apiKey,
		},
	});

	if (!resp.ok) {
		throw new Error(
			`Failed to fetch token: ${resp.status} ${await resp.text()}`,
		);
	}

	const json = TokenResponse.parse(await resp.json());
	return json.token;
}

async function getGameInfo(args: {
	config: CliConfig;
	gameId: GameIdType;
}): Promise<GameInfo> {
	const baseUrl = resolveBaseUrl(args.config.apiHost);
	const url = new URL(`/game/${args.gameId}`, baseUrl);
	const resp = await fetch(url, {
		method: "GET",
		headers: {
			"x-api-key": args.config.apiKey,
		},
	});

	if (!resp.ok) {
		throw new Error(
			`Failed to fetch game info: ${resp.status} ${await resp.text()}`,
		);
	}

	return GameInfoSchema.parse(await resp.json());
}

type SyncedGameState = {
	gameId: GameIdType;
	nytGameId: number | null;
	playerIds: PlayerIdType[];
	words: Record<string, PlayerIdType | null>;
};

type PendingSyncRequest = {
	from: PlayerIdType;
	fromName: string | null;
	nytGameId: NytGameIdType;
	requestWords: string[];
};

type Session = {
	playerId: PlayerIdType;
	name: string;
	get currentGameId(): GameIdType | null;
	setCurrentGameId: (id: GameIdType) => void;
	addWord: (word: string) => Promise<void>;
	fetchGame: (gameId?: GameIdType | null) => Promise<GameInfo>;
	listPendingSyncRequests: () => PendingSyncRequest[];
	acceptSyncRequest: (from: PlayerIdType, words: string[]) => Promise<void>;
	rejectSyncRequest: (from: PlayerIdType) => Promise<void>;
	setLogHandler: (handler: (message: string) => void) => void;
	close: () => Promise<void>;
	waitUntilClosed: () => Promise<void>;
};

async function connectSession(args: {
	config: CliConfig;
	playerId: PlayerIdType;
	name: string;
	autoAcceptSync: boolean;
	autoRejectSync: boolean;
	initialGameId: GameIdType | null;
	lockPath: string;
	onActiveGameIdChange?: (id: GameIdType | null) => void | Promise<void>;
}): Promise<Session> {
	const releaseLock = await acquireInstanceLock(args.lockPath);
	let lockReleased = false;
	const releaseLockOnce = async () => {
		if (lockReleased) {
			return;
		}
		lockReleased = true;
		await releaseLock();
	};

	let wsUrl: URL;
	let socket: WebSocket;
	try {
		const token = await getToken(args.config);
		const baseUrl = resolveBaseUrl(args.config.apiHost);
		wsUrl = new URL("/ws", baseUrl);
		wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
		wsUrl.searchParams.set("token", token);

		socket = new WebSocket(wsUrl.toString());
	} catch (error) {
		await releaseLockOnce();
		throw error;
	}

	const players = new Map<PlayerIdType, { id: PlayerIdType; name: string }>();
	const games = new Map<GameIdType, SyncedGameState>();
	const pendingSyncRequests = new Map<PlayerIdType, PendingSyncRequest>();
	let currentGameId: GameIdType | null = args.initialGameId;

	let resolveReady: (() => void) | null = null;
	const ready = new Promise<void>((resolve) => {
		resolveReady = resolve;
	});

	let resolveClosed: (() => void) | null = null;
	const closed = new Promise<void>((resolve) => {
		resolveClosed = resolve;
	});

	const send = (msg: {
		to: PlayerIdType | null;
		content: ClientMessageContent;
	}) => {
		const validated = MessageToSchema.parse(msg);
		if (socket.readyState !== WebSocket.OPEN) {
			throw new Error("Socket is not open");
		}
		socket.send(JSON.stringify(validated));
	};

	let logHandler: (message: string) => void = (message) => {
		console.log(message);
	};

	const logServer = (message: string) => {
		logHandler(message);
	};

	const persistActiveGameId = async (id: GameIdType | null) => {
		try {
			await args.onActiveGameIdChange?.(id);
		} catch (error) {
			logServer(`Failed to persist active gameId: ${String(error)}`);
		}
	};

	const handleServerMessage = async (message: MessageFrom) => {
		const content = message.content as
			| ClientMessageContent
			| ServerMessageContent;

		if (isMessageType("connect", message)) {
			send({ to: null, content: { type: "setClientId", id: args.playerId } });
			send({ to: null, content: { type: "setDisplayName", name: args.name } });
			return;
		}

		if (isMessageType("joined", message)) {
			players.set(message.content.id, {
				id: message.content.id,
				name: message.content.name,
			});

			if (message.content.id === args.playerId) {
				logServer(`Ready (name=${message.content.name})`);
				resolveReady?.();
				resolveReady = null;
			} else {
				logServer(`Joined: ${message.content.name} (${message.content.id})`);
			}
			return;
		}

		if (content.type === "left") {
			const existing = players.get(content.id);
			players.delete(content.id);
			logServer(`Left: ${existing?.name ?? "(unknown)"} (${content.id})`);
			return;
		}

		if (isMessageType("syncRequest", message)) {
			const fromName = players.get(message.from)?.name ?? null;
			const fromLabel = fromName ? `${fromName} (${message.from})` : `${message.from}`;
			logServer(
				`Sync request from ${fromLabel} for NYT game ${message.content.gameId}`,
			);

			if (args.autoRejectSync) {
				send({
					to: message.from,
					content: { type: "syncReject", gameId: message.content.gameId },
				});
				logServer(`Rejected sync request from ${fromLabel}`);
				return;
			}

			if (args.autoAcceptSync) {
				send({
					to: message.from,
					content: {
						type: "syncAccept",
						request: {
							gameId: message.content.gameId,
							words: message.content.words,
						},
						words: [],
					},
				});
				logServer(`Accepted sync request from ${fromLabel} (sending 0 words)`);
				return;
			}

			pendingSyncRequests.set(message.from, {
				from: message.from,
				fromName,
				nytGameId: message.content.gameId,
				requestWords: message.content.words,
			});

			logServer(
				`Pending sync request from ${fromLabel}. Use 'accept ${message.from} [words...]' or 'reject ${message.from}'.`,
			);
			return;
		}

		if (isMessageType("syncReject", message)) {
			logServer(
				`Sync rejected by ${message.from} (nytGameId=${message.content.gameId})`,
			);
			return;
		}

		if (isMessageType("syncStart", message)) {
			currentGameId = message.content.gameId;
			await persistActiveGameId(currentGameId);

			games.set(message.content.gameId, {
				gameId: message.content.gameId,
				nytGameId: null,
				playerIds: message.content.playerIds,
				words: message.content.words,
			});

			logServer(
				`Sync started: gameId=${message.content.gameId}, players=${message.content.playerIds.join(
					",",
				)}`,
			);
			return;
		}

		if (isMessageType("wordAdded", message)) {
			const game = games.get(message.content.gameId);
			if (game) {
				game.words[message.content.word] = message.content.playerId;
			}

			const by =
				players.get(message.content.playerId)?.name ??
				`${message.content.playerId}`;
			logServer(
				`Word added: ${message.content.word} (gameId=${message.content.gameId}, by=${by})`,
			);
			return;
		}

		if (isMessageType("error", message)) {
			logServer(
				`Server error: ${message.content.kind} - ${message.content.message}`,
			);
			return;
		}

		logServer(`Unhandled message: ${JSON.stringify(message)}`);
	};

	socket.addEventListener("open", () => {
		logServer(`WebSocket open (${wsUrl.host})`);
	});

	socket.addEventListener("close", () => {
		void releaseLockOnce();
		logServer("WebSocket closed");
		resolveClosed?.();
		resolveClosed = null;
	});

	socket.addEventListener("error", () => {
		logServer("WebSocket error");
	});

	socket.addEventListener("message", (event) => {
		try {
			const text =
				typeof event.data === "string" ? event.data : `${event.data}`;
			const parsed = MessageFromSchema.parse(JSON.parse(text));
			void handleServerMessage(parsed);
		} catch (error) {
			logServer(`Failed to handle message: ${String(error)}`);
		}
	});

	await ready;

	return {
		playerId: args.playerId,
		name: args.name,
		get currentGameId() {
			return currentGameId;
		},
		setCurrentGameId: (id) => {
			currentGameId = id;
			void persistActiveGameId(currentGameId);
		},
		addWord: async (word) => {
			if (!currentGameId) {
				throw new Error("No gameId selected (use 'game <id>' or --game-id)");
			}
			send({
				to: null,
				content: { type: "addWord", gameId: currentGameId, word },
			});
		},
		fetchGame: async (gameId) => {
			const id = gameId ?? currentGameId;
			if (!id) {
				throw new Error("No gameId selected (use 'info <id>' or 'game <id>')");
			}

			const info = await getGameInfo({ config: args.config, gameId: id });
			games.set(info.gameId, {
				gameId: info.gameId,
				nytGameId: info.nytGameId,
				playerIds: games.get(info.gameId)?.playerIds ?? [],
				words: info.words,
			});
			currentGameId = info.gameId;
			await persistActiveGameId(currentGameId);
			return info;
		},
		listPendingSyncRequests: () => {
			return Array.from(pendingSyncRequests.values());
		},
		acceptSyncRequest: async (from, words) => {
			const pending = pendingSyncRequests.get(from);
			if (!pending) {
				throw new Error(`No pending sync request from ${from}`);
			}

			send({
				to: from,
				content: {
					type: "syncAccept",
					request: {
						gameId: pending.nytGameId,
						words: pending.requestWords,
					},
					words,
				},
			});

			pendingSyncRequests.delete(from);
			logServer(
				`Accepted sync request from ${pending.fromName ?? "(unknown)"} (${from})`,
			);
		},
		rejectSyncRequest: async (from) => {
			const pending = pendingSyncRequests.get(from);
			if (!pending) {
				throw new Error(`No pending sync request from ${from}`);
			}

			send({
				to: from,
				content: { type: "syncReject", gameId: pending.nytGameId },
			});

			pendingSyncRequests.delete(from);
			logServer(
				`Rejected sync request from ${pending.fromName ?? "(unknown)"} (${from})`,
			);
		},
		setLogHandler: (handler) => {
			logHandler = handler;
		},
		close: async () => {
			socket.close();
			await closed;
		},
		waitUntilClosed: async () => {
			await closed;
		},
	};
}

async function runRepl(session: Session): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "sbp> ",
	});

	let replClosed = false;
	const output = process.stdout;

	rl.on("close", () => {
		replClosed = true;
	});

	session.setLogHandler((message) => {
		if (replClosed || !output.isTTY) {
			console.log(message);
			return;
		}

		clearLine(output, 0);
		cursorTo(output, 0);
		output.write(message.endsWith("\n") ? message : `${message}\n`);
		rl.prompt(true);
	});

	const printHelp = () => {
		console.log(
			[
				"Commands:",
				"  help                         Show this help",
				"  game <gameId>                Set current internal gameId",
				"  info [gameId]                 Fetch and print game state",
				"  add <word> [words...]         Add one or more words to current game",
				"  pending                       List pending sync requests",
				"  accept <playerId> [words...]  Accept a pending sync request",
				"  reject <playerId>             Reject a pending sync request",
				"  quit                          Disconnect and exit",
			].join("\n"),
		);
	};

	printHelp();
	rl.prompt();

	const closeAndExit = async () => {
		replClosed = true;
		session.setLogHandler((message) => console.log(message));
		rl.close();
		await session.close();
	};

	rl.on("SIGINT", () => {
		void closeAndExit();
	});

	rl.on("line", (line) => {
		void (async () => {
			const trimmed = line.trim();
			if (!trimmed) {
				rl.prompt();
				return;
			}

			const [command, ...rest] = trimmed.split(/\s+/);
			switch (command) {
				case "help": {
					printHelp();
					break;
				}

				case "quit":
				case "exit": {
					await closeAndExit();
					return;
				}

				case "game": {
					const id = rest[0];
					if (!id) {
						throw new Error("Usage: game <gameId>");
					}
					session.setCurrentGameId(GameId.parse(Number(id)));
					console.log(`Current gameId set to ${id}`);
					break;
				}

				case "info": {
					const id = rest[0] ? GameId.parse(Number(rest[0])) : null;
					const info = await session.fetchGame(id);
					console.log(JSON.stringify(info, null, 2));
					break;
				}

				case "add": {
					if (rest.length === 0) {
						throw new Error("Usage: add <word> [words...]");
					}
					for (const word of rest) {
						await session.addWord(word);
					}
					break;
				}

				case "pending": {
					const pending = session.listPendingSyncRequests();
					if (pending.length === 0) {
						console.log("No pending sync requests");
						break;
					}
					for (const req of pending) {
						const fromLabel = req.fromName
							? `${req.fromName} (${req.from})`
							: `${req.from}`;
						console.log(
							`- from=${fromLabel} nytGameId=${req.nytGameId} requestWords=${req.requestWords.length}`,
						);
					}
					break;
				}

				case "accept": {
					const fromRaw = rest[0];
					if (!fromRaw) {
						throw new Error("Usage: accept <playerId> [words...]");
					}
					const from = PlayerId.parse(Number(fromRaw));
					const words = rest.slice(1);
					await session.acceptSyncRequest(from, words);
					break;
				}

				case "reject": {
					const fromRaw = rest[0];
					if (!fromRaw) {
						throw new Error("Usage: reject <playerId>");
					}
					const from = PlayerId.parse(Number(fromRaw));
					await session.rejectSyncRequest(from);
					break;
				}

				default: {
					console.log(`Unknown command: ${command}`);
					printHelp();
					break;
				}
			}

			rl.prompt();
		})().catch((error) => {
			console.error(String(error));
			rl.prompt();
		});
	});

	await new Promise<void>((resolve) => {
		rl.on("close", () => resolve());
	});
}
