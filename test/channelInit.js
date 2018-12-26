const channelName = 'allchannel';
const helper = require('../app/helper');
const org = 'ASTRI.org';
const logger = require('../common/nodejs/logger').new('test:channel:initilize');
const ChannelUtil = require('../common/nodejs/channel');
const task = async () => {
	const client = await helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client, true);
	logger.info(channel.toString());
	ChannelUtil.clearOrderers(channel);
	ChannelUtil.clearPeers(channel);
	logger.info('after clean', channel.toString());
	const peer = helper.newPeer(0, org);
	await ChannelUtil.initialize(channel, peer);
	logger.info('after ini', channel.toString());//NOTE:can refresh orderers in network
};
task();
