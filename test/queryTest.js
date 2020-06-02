const QueryHub = require('../common/nodejs/query');
const helper = require('../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:queryTest');

describe('query', () => {
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'astri.org')];
	const org = 'icdd';
	let sampleBlockHashHex;
	const user = helper.getOrgAdmin(org);
	const channelName = 'allchannel';
	const queryHub = new QueryHub(peers, user);
	beforeEach(async () => {
		for (const peer of peers) {
			await peer.connect();
		}
	});
	it('chain info', async () => {
		const result = await queryHub.chain(channelName);
		logger.info(result);
		sampleBlockHashHex = result[0].currentBlockHash;
	});
	it('blockFromHash', async () => {
		const result = await queryHub.blockFromHash(channelName, sampleBlockHashHex);
		logger.info(result);
	});
	it('blockFromHeight', async () => {
		const result = await queryHub.blockFromHeight(channelName, 2);
		logger.info(result);
	});

	it('channelJoined', async () => {
		const result = await queryHub.channelJoined();
		logger.info(result);
	});
});

describe('queryTransaction', () => {
	const {txID} = process.env;
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'astri.org')];
	const org = 'icdd';
	const user = helper.getOrgAdmin(org);
	const queryHub = new QueryHub(peers, user);
	const channelName = 'allchannel';
	it('by txID', async () => {
		if (!txID) {
			logger.warn('tx id not found, skipped');
			return;
		}
		const result = await queryHub.tx(channelName, txID);
		logger.info(result);
	});
});
