import QueryHub from '../common/nodejs/query.js';
import * as  helper from '../app/helper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import EventHub from '../common/nodejs/admin/eventHub.js';
import {emptyChannel} from '../common/nodejs/admin/channel.js';
import EventHubQuery from '../common/nodejs/eventHub.js';
import assert from 'assert';

const logger = consoleLogger('test:queryTest');

describe('query', async function () {
	this.timeout(0);
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'astri.org')];
	const org = 'icdd';
	let sampleBlockHashHex;
	const user = helper.getOrgAdmin(org);
	const channelName = 'allchannel';
	const queryHub = new QueryHub(peers, user);
	before(async () => {
		await queryHub.connect();
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
		try {
			await queryHub.channelJoined();
			assert.fail('query channelJoined on another org is not allowed');
		} catch (e) {
			logger.warn(e);
		}
		const own_peers = [helper.newPeer(0, 'icdd')];
		const _queryHub = new QueryHub(own_peers, user);
		await _queryHub.connect();
		const result = await _queryHub.channelJoined();
		assert.strictEqual(result[0][0], channelName);
	});
	after(async () => {
		await queryHub.disconnect();
	});
});

describe('queryTransaction', function () {
	this.timeout(0);
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'astri.org')];
	const org = 'icdd';
	const user = helper.getOrgAdmin(org);
	const eventer = peers[0].eventer;
	const queryHub = new QueryHub(peers, user);
	const channelName = 'allchannel';
	const channel = emptyChannel(channelName);
	const eventHub = new EventHub(channel, eventer);
	it('for all transactions', async () => {
		const eventHubQuery = new EventHubQuery(eventHub, queryHub.identityContext);
		const txs = await eventHubQuery.replayTx(4);
		logger.info(txs);
		const {transactionId} = txs[0];
		logger.info('query on txID', transactionId);

		await queryHub.connect();
		const result = await queryHub.tx(channelName, transactionId);
		logger.info(result);
		await queryHub.disconnect();
	});
	it('for single transaction', async () => {

		for (const peer of peers) {
			await peer.connect();
		}
		// NOTE: channel config tx cannot be found by query
		const transactionId = 'b4da8d97a0a998ab288590036f5a3ce056ff7d504263dd4b6549b44cb015a1af';

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

