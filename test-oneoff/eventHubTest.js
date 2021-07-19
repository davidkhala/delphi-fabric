const EventHub = require('../common/nodejs/admin/eventHub');
const UserUtil = require('../common/nodejs/admin/user');
const {BlockNumberFilterType: {NEWEST, OLDEST}} = require('../common/nodejs/formatter/eventHub');

const helper = require('../app/helper');
const org = 'astri.org';
const logger = require('khala-logger/log4js').consoleLogger('test:eventHub');
const BlockDecoder = require('../common/nodejs/formatter/blockDecoder');
describe('eventhub', () => {
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

