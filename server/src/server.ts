// Wrappers around HyperExpress commponents that tailor types for this use
// case.

import HyperExpress, {
	DefaultRequestLocals,
	DefaultResponseLocals,
	MiddlewareNext,
	Websocket as HeWebsocket,
	ServerConstructorOptions,
} from "hyper-express";
import type { ClientId } from "./message.js";

export type Client = {
	name: string;
	socket: Websocket;
};

type Token = string;

export type AppLocals = {
	version: number;
	apiKey: string;
	clients: Map<ClientId, Client>;
	tokens: Map<Token, Date>;
};

export type UserRouteHandler = (request: Request, response: Response) => void;

export type MiddlewareHandler = (
	request: Request,
	response: Response,
) => Promise<void | Error>;

export { MiddlewareNext };

export type WebsocketContext = Record<string, unknown>;

export type Websocket = Omit<HeWebsocket, "context"> & {
	context: WebsocketContext;
};

export type WSRouteHandler = (socket: Websocket) => void;

export interface Server
	extends Omit<
		HyperExpress.Server,
		| "locals"
		| "get"
		| "post"
		| "delete"
		| "patch"
		| "upgrade"
		| "ws"
		| "use"
		| "options"
	> {
	locals: AppLocals;
	app: Server;

	use: (middleware: MiddlewareHandler) => Server;
	get: (
		path: string,
		options: { middlewares?: MiddlewareHandler[] },
		handler: UserRouteHandler,
	) => Server;
	post: (
		path: string,
		options: { middlewares?: MiddlewareHandler[] },
		handler: UserRouteHandler,
	) => Server;
	delete: (
		path: string,
		options: { middlewares?: MiddlewareHandler[] },
		handler: UserRouteHandler,
	) => Server;
	patch: (
		path: string,
		options: { middlewares?: MiddlewareHandler[] },
		handler: UserRouteHandler,
	) => Server;
	options: (
		path: string,
		options: { middlewares?: MiddlewareHandler[] },
		handler?: UserRouteHandler,
	) => Server;
	upgrade: (
		path: string,
		options: { middlewares?: MiddlewareHandler[] },
		handler: UserRouteHandler,
	) => Server;
	ws: (path: string, handler: WSRouteHandler) => Server;
}

export function createServer(
	locals: AppLocals,
	init?: ServerConstructorOptions,
): Server {
	const hserver = new HyperExpress.Server(init);
	const server = hserver as unknown as Server;
	server.locals = { ...locals };
	return server;
}

export type Response = Omit<
	HyperExpress.Response<DefaultResponseLocals>,
	"app"
> & { app: Server };

export type Request = Omit<
	HyperExpress.Request<DefaultRequestLocals>,
	"app" | "locals"
> & { app: Server; locals: {} };
