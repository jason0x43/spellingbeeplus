import type { Request, Response } from "./server.js";
import { log } from "./util.js";

export async function keyRequired(request: Request, _response: Response) {
	const headers = request.headers;
	const apiKey = headers["x-api-key"];
	if (!apiKey) {
		log.warn("Missing authorization header");
		throw new Error("not authorized");
	}

	if (apiKey !== request.app.locals.apiKey) {
		log.warn("Invalid API key");
		throw new Error("not authorized");
	}
}

export async function tokenRequired(request: Request, _response: Response) {
	const query = request.query_parameters;
	const token = query.token;

	if (!token) {
		log.warn("Missing token");
		throw new Error("not authorized");
	}

	const tokens = request.app.locals.tokens;
	const expiry = tokens.get(token);

	if (!expiry) {
		log.warn("Invalid token");
		throw new Error("not authorized");
	}

	if (expiry < new Date()) {
		log.warn("Expired token");
		throw new Error("not authorized");
	}
}

type CorsOptions = {
	origin?: string;
	credentials?: boolean;
	method?: string;
	extraHeaders?: string;
	optionsRoute?: boolean;
};

export function useCors(options?: CorsOptions) {
	return async (request: Request, response: Response) => {
		log.debug(`Handling [${request.method}] ${request.path}`);

		response.header("vary", "Origin");
		response.header(
			"Access-Control-Allow-Headers",
			`content-type${options?.extraHeaders ? "," + options.extraHeaders : ""}`,
		);
		response.header(
			"Access-Control-Allow-Methods",
			options?.method ?? "OPTIONS, POST, GET",
		);
		response.header("Access-Control-Allow-Origin", options?.origin ?? "*");
		response.header(
			"Access-Control-Allow-Credentials",
			options?.credentials ? "true" : "false",
		);

		if (request.method === "OPTIONS") {
			response.send("");
		}
	};
}
