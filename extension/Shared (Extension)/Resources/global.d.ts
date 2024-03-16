export {};

type Runtime = Omit<typeof chrome.runtime, "onSuspend" | "onSuspendCanceled">;

type ExtensionStorage = {
	sync: {
		async get(
			keys: string | string[] | Record<string, unknown>,
		): Promise<StorageResult>;
		async set(input: { [key: string]: unknown }): Promise<void>;
		async remove(keys: string | string[]): Promise<void>;
		async clear(): Promise<void>;
	};
};

type StorageResult = Record<string, unkown>;

declare global {
	const browser: {
		runtime: Runtime;
		storage: ExtensionStorage;
	};

	interface Window {
		gameData: GameData | undefined;
	}
}
