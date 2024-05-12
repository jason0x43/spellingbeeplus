/**
 * Send a message to the extension and return the response, if any.
 *
 * Keep retrying until a response is received.
 *
 * @param {string} name
 * @param {string} type
 */
export async function getNativeInfo(name, type) {
	while (true) {
		console.log(`Requesting ${name} (${type})...`);
		try {
			const info = await browser.runtime.sendMessage({ type });
			console.log(`Got response: ${JSON.stringify(info)}`);
			if (info) {
				return info;
			}
		} catch (error) {
			console.log(`Error getting ${name}: ${error}`);
		}

		console.log('No response');
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

