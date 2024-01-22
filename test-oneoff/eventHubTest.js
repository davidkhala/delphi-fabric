import EventHub from '../common/nodejs/admin/eventHub.js';
import UserUtil from '../common/nodejs/admin/user.js';
import * as helper from '../app/helper.js';
import {BlockNumberFilterType} from '../common/nodejs/formatter/eventHub.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {BlockDecoder} from '@hyperledger-twgc/fabric-formatter';
import assert from 'assert';

const logger = consoleLogger('test:eventHub');
const {NEWEST, OLDEST} = BlockNumberFilterType;
const org = 'astri.org';
describe('eventhub', function () {
	this.timeout(0);
	const channelName = 'allchannel';
	const user = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName);
	logger.info(channel.toString());
	const peer = helper.newPeer(0, org);
	const orderers = helper.newOrderers();
	const orderer = orderers[0];

	it('san check', async () => {
		new EventHub(channel, orderer.eventer);
		UserUtil.getIdentityContext(user);
		assert.ok(typeof BlockDecoder === 'function');
	});
	it('block parser', async () => {

		const eventHub = new EventHub(channel, peer.eventer);
		const identityContext = UserUtil.getIdentityContext(user);
		const startBlock = OLDEST;
		const endBlock = NEWEST;
		eventHub.build(identityContext, {startBlock, endBlock});
		await eventHub.connect();
		const callback = (error, event) => {
			if (error) {
				logger.error(error);
				return;
			}
			const {block} = event;
			console.debug(block)
			const decoder = new BlockDecoder(block);
			const {number} = decoder.header();
			logger.debug(`---block ${number}---`);
			const [_, txs] = decoder.data();
			logger.debug(txs);
		};
		eventHub.blockEvent(callback);
	});
});
describe('tx replay', () => {
	const channelName = 'allchannel';
	const user = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName);
	logger.info(channel.toString());
	const peer = helper.newPeer(0, org);

	it('block parser', async function () {
		this.timeout(0);
		const eventHub = new EventHub(channel, peer.eventer);
		const identityContext = UserUtil.getIdentityContext(user);
		const startBlock = OLDEST;
		const endBlock = NEWEST;
		eventHub.build(identityContext, {startBlock, endBlock});
		await eventHub.connect();
		const callback = (error, event) => {
			if (error) {
				logger.error(error);
				return;
			}
			const {block} = event;
			const decoder = new BlockDecoder(block);
			const {number} = decoder.header();
			logger.debug(`---block ${number}---`);
			const [_, txs] = decoder.data();
			logger.debug(txs);
		};
		eventHub.blockEvent(callback);
	});
});
