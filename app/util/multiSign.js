const logger = require('./logger').new('multi-signature');
exports.signs = (clientSwitchPromises, proto) => {
	const signatures = [];
	let promiseChain = Promise.resolve();
	for (let promise of clientSwitchPromises) {
		promiseChain = promiseChain.then(() => promise)
			.then((client) => {
				logger.debug('signature identity', client.getUserContext().getName());
				signatures.push(client.signChannelConfig(proto));
				return Promise.resolve();
			});

	}
	return promiseChain.then(() => signatures);

};