const helper = require('../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:peer');
describe('peer', () => {
	it('ping', async () => {
		const peers = helper.allPeers();
		for (const peer of peers) {
			const result = await peer.ping(peer);
			logger.debug(peer.toString(), result);
		}
	});
});
