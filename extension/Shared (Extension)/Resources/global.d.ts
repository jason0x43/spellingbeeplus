export {};

type Runtime = Omit<typeof chrome.runtime, 'onSuspend' | 'onSuspendCanceled'>;

declare global {
	const browser: {
		runtime: Runtime
	};

	interface Window {
		gameData: GameData | undefined;
	}
}
