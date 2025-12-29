import { randomUUID } from "node:crypto";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import type { Context } from "./context.js";
import {
	MessageTo,
	messageFromClient,
	messageFromServer,
	type SyncStart,
} from "./message.js";
import { keyRequired, tokenRequired } from "./middlewares.js";
import type { AppEnv, Client } from "./types.js";
import { GameId, type GameInfo, NytGameId, PlayerId } from "./types.js";
import { log } from "./util.js";

const app = new Hono<AppEnv>();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
export { injectWebSocket };

export function routes(ctx: Context) {
	return app
		.get(
			"/ws",
			tokenRequired(ctx),
			upgradeWebSocket(() => {
				let client: Client = {
					id: 0 as PlayerId,
					name: "",
				};

				return {
					onOpen: (_, ws) => {
						// Send the client the current server version, which may cause the
						// client to reload
						ws.send(
							messageFromServer({
								type: "connect",
								version: ctx.version,
							}),
						);
					},

					onMessage: async (evt, ws) => {
						const msg = MessageTo.parse(JSON.parse(`${evt.data}`));
						log.debug("Received message", msg);

						if (!client.id) {
							// We need the client ID, so only handle setClientId messages
							if (msg.content.type === "setClientId") {
								const clientId = msg.content.id;
								log.debug(`Client ID is ${clientId}`);

								const ctxClient = ctx.clients.get(clientId);
								if (ctxClient) {
									// A client record already exists for the client's ID
									client = ctxClient;
								} else {
									// Use the default record for this client ID
									client.id = clientId;
									ctx.clients.set(client.id, client);
								}

								ctx.connections.set(ws, client.id);

								// Tell the new client about any existing clients
								log.debug(`Notifying ${client.id} of existing clients...`);
								for (const [_, otherClient] of ctx.clients) {
									if (otherClient.id !== client.id) {
										ws.send(
											messageFromServer({ ...otherClient, type: "joined" }),
										);
									}
								}

								if (client.name) {
									// The client ID already has a name; tell it to the newly
									// connected client
									log.debug(
										`Telling ${client.id} its name is ${client.name}...`,
									);
									ws.send(messageFromServer({ ...client, type: "joined" }));
								}
							}
						} else if (!client.name) {
							// We need the client name, so only handle setName messages
							if (msg.content.type === "setDisplayName") {
								await handleSetName(msg.content.name, client, ctx);
							}
						} else if (msg.content.type === "leave") {
							// A client is disconnecting
							log.debug(`Disconnecting ${client.id}...`);
							ws.close();
						} else if (msg.content.type === "setDisplayName") {
							// A client is updating its display name
							await handleSetName(msg.content.name, client, ctx);
						} else if (msg.content.type === "addWord") {
							log.debug(`Adding a word to ${msg.content.gameId}`);
							// A client is adding words to any synced games; update the
							// internal game and notify the other player

							const game = await ctx.db.getGame(msg.content.gameId);
							const playerIds = await ctx.db.getPlayerIds(game.id);
							const words = await ctx.db.getWords(game.id);
							const others = playerIds.filter((p) => p !== client.id);
							const word = msg.content.word;

							if (!words.find((w) => w.word === word)) {
								await ctx.db.addWord({
									gameId: game.id,
									word,
									playerId: client.id,
								});

								for (const other of others) {
									for (const [otherSocket, otherClientId] of ctx.connections) {
										if (otherClientId !== other) {
											continue;
										}

										otherSocket.send(
											messageFromServer({
												type: "wordAdded",
												gameId: msg.content.gameId,
												playerId: client.id,
												word,
											}),
										);
										log.debug(`Sent word from ${client.id} to ${other}`);
									}
								}
							}
						} else if (msg.content.type === "syncAccept") {
							// A player has accepted a sync request.
							log.debug(`Sync accepted`);

							// Determine who's in the game
							const player1 = msg.to;
							const player2 = ctx.connections.get(ws);
							if (!player1 || !player2) {
								throw new Error("Could not determine players in game");
							}

							// Create (or reuse) a game.
							const game = await ctx.db.getOrCreateGame({
								gameId: msg.content.request.gameId,
								playerIds: [player1, player2],
							});

							// Add the game words
							const player1Words = msg.content.request.words;
							const player2Words = msg.content.words;
							const gameWords: Record<string, PlayerId | null> = {};
							for (const word of player1Words) {
								if (player2Words.includes(word)) {
									gameWords[word] = null;
								} else {
									gameWords[word] = player1;
								}
							}
							for (const word of player2Words) {
								if (gameWords[word] === undefined) {
									gameWords[word] = player2;
								}
							}
							await ctx.db.addWords({
								gameId: game.id,
								words: gameWords,
							});

							const gameWordsSaved = await ctx.db.getWords(game.id);
							const syncedWords: Record<string, PlayerId | null> = {};
							for (const wordRow of gameWordsSaved) {
								syncedWords[wordRow.word] = wordRow.playerId ?? null;
							}

							// Send a syncStart message to all players
							const startMsg: SyncStart = {
								type: "syncStart",
								gameId: game.id,
								playerIds: [player1, player2],
								words: syncedWords,
							};
							for (const [socket, clientId] of ctx.connections) {
								if (clientId === player1 || clientId === player2) {
									socket.send(messageFromServer(startMsg));
									log.debug(
										`Sent syncStart message from server to ${clientId}`,
									);
								}
							}
						} else if (msg.to) {
							log.debug(`Forwarding message to ${msg.to}`);

							// Forward any other messages to the proper receiver
							for (const [otherSocket, otherClientId] of ctx.connections) {
								if (otherClientId === msg.to) {
									otherSocket.send(messageFromClient(client.id, msg.content));
									log.debug(`Sent message from ${client.id} to ${msg.to}`);
								}
							}
						} else {
							log.warn(`Not handling message from ${client.id}:`, msg);
						}
					},

					onClose: (_, ws) => {
						if (!ctx.connections.has(ws)) {
							return;
						}

						ctx.connections.delete(ws);

						// Tell other clients that one left
						log.debug(`Notifying other clients that ${client.id} left...`);
						for (const [otherClient, _] of ctx.connections) {
							otherClient.send(
								messageFromServer({ type: "left", id: client.id }),
							);
						}
					},
				};
			}),
		)
		.get("/token", keyRequired(ctx), async (c) => {
			const token = randomUUID();
			const expiry = new Date();
			expiry.setSeconds(expiry.getSeconds() + 10);
			ctx.tokens.set(token, expiry);
			return c.json({ token });
		})
		.get("/game/:id", keyRequired(ctx), async (c) => {
			const id = c.req.param("id");

			// Legacy format: {nytGameId}-{playerId}-{playerId}...
			// Current format: internal {gameId}
			const game = id.includes("-")
				? await (async () => {
						const [nytGameId, ...nytPlayerIds] = id.split("-");
						return await ctx.db.getGameByNytIds(
							NytGameId.parse(nytGameId),
							nytPlayerIds.map((playerId) => PlayerId.parse(playerId)),
						);
					})()
				: await ctx.db.getGame(GameId.parse(id));

			const gameWords = await ctx.db.getWords(game.id);

			const words: GameInfo["words"] = {};
			for (const word of gameWords) {
				words[word.word] = word.playerId ?? null;
			}

			const gameInfo: GameInfo = {
				nytGameId: game.nytGameId,
				gameId: game.id,
				words,
			};

			return c.json(gameInfo);
		})
		.get("/*", serveStatic({ root: "public" }));
}

async function handleSetName(name: string, client: Client, ctx: Context) {
	const oldName = client.name;
	client.name = name;
	log.debug(`Client ${client.id} is named ${client.name}`);

	try {
		await ctx.db.upsertPlayer({ playerId: client.id, name: client.name });
	} catch (error) {
		log.warn(`Failed to upsert player ${client.id}: ${String(error)}`);
	}

	log.debug(`Notifying clients of ${client.id}'s name...`);
	for (const [socket, cid] of ctx.connections) {
		// Don't tell client its name if it already knows
		if (cid === client.id && name === oldName) {
			continue;
		}
		socket.send(messageFromServer({ ...client, type: "joined" }));
	}
}
