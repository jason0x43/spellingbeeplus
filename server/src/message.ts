import { z } from "zod";
import { GameId, NytGameId, PlayerId } from "./types.js";

/**
 * A message that sent to newly connected players.
 */
export const Connect = z.object({
	type: z.literal("connect"),
	version: z.number(),
});
export type Connect = z.infer<typeof Connect>;

/**
 * A message for a client to set its ID
 */
export const SetClientId = z.object({
	type: z.literal("setClientId"),
	id: PlayerId,
});
export type SetClientId = z.infer<typeof SetClientId>;

/**
 * A message for a client to set its display name
 */
export const SetDisplayName = z.object({
	type: z.literal("setDisplayName"),
	name: z.string(),
});
export type SetDisplayName = z.infer<typeof SetDisplayName>;

/**
 * A message that a player has joined.
 */
export const Joined = z.object({
	type: z.literal("joined"),
	id: PlayerId,
	name: z.string(),
});
export type Joined = z.infer<typeof Joined>;

/**
 * A message that a player wishes to leave the game.
 */
export const Leave = z.object({
	type: z.literal("leave"),
});
export type Leave = z.infer<typeof Leave>;

/**
 * A message that a player has left.
 */
export const Left = z.object({
	type: z.literal("left"),
	id: PlayerId,
});
export type Left = z.infer<typeof Left>;

/**
 * A message to request a sync.
 */
export const SyncRequest = z.object({
	type: z.literal("syncRequest"),
	gameId: NytGameId,
	words: z.array(z.string()),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

/**
 * A message to accept a sync request.
 *
 * This message includes the original request data.
 */
export const SyncAccept = z.object({
	type: z.literal("syncAccept"),
	request: z.object({
		gameId: NytGameId,
		words: z.array(z.string()),
	}),
	words: z.array(z.string()),
});
export type SyncAccept = z.infer<typeof SyncAccept>;

/**
 * A message to reject a sync request.
 *
 * This message includes the original request data.
 */
export const SyncReject = z.object({
	type: z.literal("syncReject"),
	gameId: NytGameId,
});
export type SyncReject = z.infer<typeof SyncReject>;

/**
 * A message to start a sync session
 *
 * This message includes the original request data.
 */
export const SyncStart = z.object({
	type: z.literal("syncStart"),
	playerIds: z.array(PlayerId),
	gameId: GameId,
	words: z.record(z.string(), PlayerId.nullable()),
});
export type SyncStart = z.infer<typeof SyncStart>;

/**
 * A messsage to add a word
 */
export const AddWord = z.object({
	type: z.literal("addWord"),
	gameId: GameId,
	word: z.string(),
});
export type AddWord = z.infer<typeof AddWord>;

/**
 * A message from the server announcing an added word.
 */
export const WordAdded = z.object({
	type: z.literal("wordAdded"),
	gameId: GameId,
	word: z.string(),
	playerId: PlayerId,
});
export type WordAdded = z.infer<typeof WordAdded>;

/**
 * An Error from the server
 */
export const ServerError = z.object({
	type: z.literal("error"),
	kind: z.enum(["nameUnavailable", "missingName", "invalidCommand"]),
	message: z.string(),
});
export type ErrMsg = z.infer<typeof ServerError>;

export const ClientMessageContent = z.discriminatedUnion("type", [
	SetClientId,
	SetDisplayName,
	SyncRequest,
	SyncAccept,
	SyncReject,
	AddWord,
	Leave,
]);
export type ClientMessageContent = z.infer<typeof ClientMessageContent>;
export type ClientMessageType = ClientMessageContent["type"];
export type ClientMessageTypes = {
	[U in ClientMessageContent as U["type"]]: U["type"] extends U["type"]
		? U
		: never;
};

export const ServerMessageContent = z.discriminatedUnion("type", [
	Connect,
	Joined,
	Left,
	SyncStart,
	WordAdded,
	ServerError,
]);
export type ServerMessageContent = z.infer<typeof ServerMessageContent>;
export type ServerMessageType = ServerMessageContent["type"];
export type ServerMessageTypes = {
	[U in ServerMessageContent as U["type"]]: U["type"] extends U["type"]
		? U
		: never;
};

export const MessageFrom = z.union([
	z.object({
		from: PlayerId,
		content: ClientMessageContent,
	}),
	z.object({
		from: z.null(),
		content: ServerMessageContent,
	}),
]);
export type MessageFrom = z.infer<typeof MessageFrom>;

export type ClientMessage<C extends ClientMessageContent> = {
	from: PlayerId;
	content: C;
};

export type ServerMessage<C extends ServerMessageContent> = {
	from: null;
	content: C;
};

/**
 * Type guard indicating if a message is of a given type.
 */
export function isMessageType<T extends ClientMessageType | ServerMessageType>(
	type: T,
	message: MessageFrom,
): message is T extends ClientMessageType
	? ClientMessage<ClientMessageTypes[T]>
	: T extends ServerMessageType
		? ServerMessage<ServerMessageTypes[T]>
		: never {
	return message.content.type === type;
}

export const MessageTo = z.object({
	to: z.union([PlayerId, z.null()]),
	content: ClientMessageContent,
});
export type MessageTo = z.infer<typeof MessageTo>;

export function messageFromClient(
	from: PlayerId,
	content: ClientMessageContent,
): string {
	return JSON.stringify({
		from,
		content,
	} satisfies MessageFrom);
}

export function messageFromServer(content: ServerMessageContent): string {
	return JSON.stringify({
		from: null,
		content,
	} satisfies MessageFrom);
}
