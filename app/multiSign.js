const helper = require('./helper')
const logger = helper.getLogger('multi-signature')
exports.signs = (client, clientSwitchPromises, proto) => {
	const signatures = []
	let promiseAll = Promise.resolve()
	for (let promise of clientSwitchPromises) {
		promiseAll = promiseAll.then(() => {
			return promise(client).then(() => {
				logger.debug('signature identity', client.getUserContext().getName())
				signatures.push(client.signChannelConfig(proto))
				return Promise.resolve()
			})
		})
	}
	return promiseAll.then(() => signatures)

}