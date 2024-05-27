export function getEnv(key: string): string {
	const value = process.env[key];
	if (value === undefined) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function timestamp(): string {
	return new Date().toLocaleTimeString();
}

export const log =
	process.env.LOG_TIMESTAMPS === "1"
		? {
				info(...args: unknown[]): void {
					console.log(`${timestamp()}`, ...args);
				},

				error(...args: unknown[]): void {
					console.error(`${timestamp()}`, ...args);
				},

				warn(...args: unknown[]): void {
					console.warn(`${timestamp()}`, ...args);
				},

				debug(...args: unknown[]): void {
					console.debug(`${timestamp()}`, ...args);
				},
			}
		: {
				info: console.log,
				error: console.error,
				warn: console.warn,
				debug: console.debug,
			};
