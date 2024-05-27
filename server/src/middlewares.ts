import type { Request, Response } from "./server.js";
import { log } from "./util.js";

export async function keyRequired(request: Request, response: Response) {
	const headers = request.headers;
	const apiKey = headers["x-api-key"];
	if (!apiKey) {
		log.warn("Missing authorization header");
		response.status(401).send("not authorized");
		return;
	}

	if (apiKey !== request.app.locals.apiKey) {
		log.warn("Invalid API key");
		response.status(401).send("not authorized");
		return;
	}
}

export async function tokenRequired(request: Request, response: Response) {
	const query = request.query_parameters;
	const token = query.token;

	if (!token) {
		log.warn("Missing token");
		response.status(401).send("not authorized");
		return;
	}

	const tokens = request.app.locals.tokens;
	const expiry = tokens.get(token);

	if (!expiry) {
		log.warn("Invalid token");
		response.status(401).send("not authorized");
		return;
	}

	if (expiry < new Date()) {
		log.warn("Expired token");
		response.status(401).send("not authorized");
		return;
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
