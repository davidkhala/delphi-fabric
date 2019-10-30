const {newEventHub, blockEvent} = require('../common/nodejs/eventHub');

const channelName = 'allchannel';
const helper = require('../app/helper');
const org = 'astri.org';
const logger = helper.getLogger('test:eventHub');
const ChannelUtil = require('../common/nodejs/channel');

const task = async () => {
	const client = await helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client, true);
	logger.info(channel.toString());
	ChannelUtil.clearOrderers(channel);
	ChannelUtil.clearPeers(channel);
	const peer = helper.newPeer(0, org);
	const eventHub = newEventHub(channel, peer, true);
	blockEvent(eventHub, undefined, (block) => {
		logger.debug(block.header.number);
		logger.debug('inspect data', block.data.data[0].payload.data.actions[0].payload.action.proposal_response_payload.extension.results);

	}, () => {

	});
};
task();
