import("./config.js")
	.then((config) =>
		import(`https://${config.default.apiHost}/sbp.js`).then((sbp) => ({
			sbp,
			config: config.default,
		})),
	)
	.then(({ sbp, config }) => sbp.main(config))
	.catch((error) => {
		console.error(`Error running SBP: ${error}`);
	});
