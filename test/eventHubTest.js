import EventHub from '../common/nodejs/admin/eventHub.js';
import UserUtil from '../common/nodejs/admin/user.js';
import {BlockNumberFilterType} from '../common/nodejs/formatter/eventHub.js';
import * as helper from '../app/helper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';

const {NEWEST, OLDEST} = BlockNumberFilterType;
const channelName = 'allchannel';
const org = 'astri.org';

const logger = consoleLogger('test:eventHub');

describe('eventhub', function () {
	this.timeout(0);
	const user = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName);
	logger.info(channel.toString());
	const peer = helper.newPeer(0, org);
	const eventHub = new EventHub(channel, peer.eventer);
	before(async () => {
		await peer.connect();
	});
	it('connect', async () => {


		const identityContext = UserUtil.getIdentityContext(user);
		const startBlock = OLDEST;

		eventHub.build(identityContext, {startBlock});
		await eventHub.connect();
	});
	after(async () => {
		await eventHub.disconnect();
		await peer.disconnect();
	});
});

