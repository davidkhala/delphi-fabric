const EventHub = require('../common/nodejs/admin/eventHub');
const UserUtil = require('../common/nodejs/admin/user');
const {BlockNumberFilterType: {NEWEST, OLDEST}} = require('../common/nodejs/formatter/eventHub');
const channelName = 'allchannel';
const helper = require('../app/helper');
const org = 'astri.org';
const logger = require('khala-logger/log4js').consoleLogger('test:eventHub');

describe('eventhub', () => {

	const user = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName);
	logger.info(channel.toString());
	const peer = helper.newPeer(0, org);

	it('connect', async function () {
		this.timeout(0);
		const eventHub = new EventHub(channel, peer.eventer);
		const identityContext = UserUtil.getIdentityContext(user);
		const startBlock = OLDEST;

		eventHub.build(identityContext, {startBlock});
		await eventHub.connect();
	});
});

