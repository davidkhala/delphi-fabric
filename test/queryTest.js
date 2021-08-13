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
		const result = await queryHub.getChainInfo(channelName);
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
const EventHubQuery = require('../common/nodejs/eventHub');
describe('queryTransaction', () => {
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'astri.org')];
	const org = 'icdd';
	const user = helper.getOrgAdmin(org);
	const eventer = peers[0].eventer;
	const queryHub = new QueryHub(peers, user);
	const channelName = 'allchannel';
	const channel = emptyChannel(channelName);
	const eventHub = new EventHub(channel, eventer);
	it('for all transactions', async function () {
		this.timeout(0);
		const eventHubQuery = new EventHubQuery(eventHub, queryHub.identityContext);
		const txs = await eventHubQuery.replayTx(4);
		logger.info(txs);
		const {transactionId} = txs.find(tx => tx.transactionId);
		logger.info('query on txID', transactionId);
		for (const peer of peers) {
			await peer.connect();
		}

		const result = await queryHub.tx(channelName, transactionId);
		logger.info(result);
	});
	it('for single transaction', async function () {
		this.timeout(0);
		for (const peer of peers) {
			await peer.connect();
		}
		// NOTE: channel config tx cannot be found by query
		const transactionId = '2f01799f8235107808d2973cda997f145d686b23571b5c1418402d081b3d40ff';

		const result = await queryHub.tx(channelName, transactionId);
		logger.info(result);


	});
});

describe('query lifecycle chaincode', () => {
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	const admin = helper.getOrgAdmin(org1);
	const queryHub = new QueryHub(peers, admin);
	before(async () => {
		for (const peer of peers) {
			await peer.connect();
		}
	});
	it('all chaincodes', async function () {
		this.timeout(0);
		const installed = await queryHub.chaincodesInstalled();
		console.debug(installed);

	});

});

