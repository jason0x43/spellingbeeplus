import { z } from "zod";

export type ClientId = string & { __type: "ClientId" };
export const ClientId: z.Schema<ClientId> = z.string() as any;

export const Connect = z.object({
	version: z.number(),
});
export type Connect = z.infer<typeof Connect>;

export const Joined = z.object({
	id: ClientId,
	name: z.string(),
});
export type Joined = z.infer<typeof Joined>;

export const Sync = z.object({
	requestId: z.string(),
	words: z.array(z.string()),
});
export type Sync = z.infer<typeof Sync>;

export const ErrMsg = z.object({
	kind: z.enum(["nameUnavailable", "missingName", "invalidCommand"]),
	message: z.string(),
});
export type ErrMsg = z.infer<typeof ErrMsg>;

export const Message = z.union([Connect, Joined, Sync, ErrMsg]);
export type Message = z.infer<typeof Message>;

export type GameId = string & { __type: "GameId" };
export const GameId: z.Schema<GameId> = z.string() as any;

export const StatusRequest = z.object({
	otherPlayer: ClientId,
	gameId: GameId,
});
export type StatusRequest = z.infer<typeof StatusRequest>;

export const GameStatus = z.object({
	player1: ClientId,
	player2: ClientId,
	gameId: GameId,
	words: z.array(
		z.object({
			word: z.string(),
			player: ClientId,
		}),
	),
});
export type GameStatus = z.infer<typeof GameStatus>;

export const MessageContent = z.union([
	// A client is connecting
	z.object({ connect: Connect }),
	// A client is updating its unique ID
	z.object({ setClientId: ClientId }),
	// A client is updating its display name
	z.object({ setName: z.string() }),
	// A new client has joined the server
	z.object({ joined: Joined }),
	// A client is requesting to sync with another client
	z.object({ sync: Sync }),
	// A client is requesting the status of a game with another client
	z.object({ getStatus: StatusRequest }),
	// A client is requesting the status of a game with another client
	z.object({ status: GameStatus }),
	// A client refused a sync request
	z.object({ noSync: z.string() }),
	// A client disconnected from the server
	z.object({ left: ClientId }),
	// An error was emitted in response to a message
	z.object({ error: ErrMsg }),
]);
export type MessageContent = z.infer<typeof MessageContent>;

export const MessageFrom = z.object({
	from: ClientId,
	content: MessageContent,
});
export type MessageFrom = z.infer<typeof MessageFrom>;

export const MessageTo = z.object({
	to: z.union([ClientId, z.null()]),
	content: MessageContent,
});
export type MessageTo = z.infer<typeof MessageTo>;

export function messageFrom(from: ClientId, content: MessageContent): string {
	return JSON.stringify({
		from,
		content,
	} satisfies MessageFrom);
}
