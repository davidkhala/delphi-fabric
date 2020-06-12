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
const EventHub = require('../common/nodejs/admin/eventHub');
const {emptyChannel} = require('../common/nodejs/admin/channel');
const {replayTx} = require('../common/nodejs/eventHub');
describe('queryTransaction', () => {
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'astri.org')];
	const org = 'icdd';
	const user = helper.getOrgAdmin(org);
	const eventer = peers[0].eventer;
	const queryHub = new QueryHub(peers, user);
	const channelName = 'allchannel';
	const channel = emptyChannel(channelName);
	const eventHub = new EventHub(channel, eventer);
	it('by txID', async function () {
		this.timeout(30000);
		const txs = await replayTx(eventHub, queryHub.identityContext, 3);
		logger.info(txs);
		const {transactionId} = txs[0];
		for (const peer of peers) {
			await peer.connect();
		}
		const result = await queryHub.tx(channelName, transactionId);
		logger.info(result);
	});
});
