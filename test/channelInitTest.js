const {setGlobal} = require('../common/nodejs/logger');
// setGlobal(true);
const channelName = 'allchannel';
const helper = require('../app/helper');
const org = 'ASTRI.org';
const logger = helper.getLogger('test:channel:initialize');
const ChannelUtil = require('../common/nodejs/channel');
const ServiceDiscoveryUtil = require('../common/nodejs/serviceDiscovery');

const task = async () => {
	const client = await helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client, true);
	logger.info(channel.toString());
	ChannelUtil.clearOrderers(channel);
	ChannelUtil.clearPeers(channel);
	logger.info('after clean', channel.toString());
	const peer = helper.newPeer(0, org);
	await ServiceDiscoveryUtil.initialize(channel, peer);
	logger.info('after ini', channel.toString());// NOTE:can refresh orderers in network
	logger.info('channel.getOrganisations()', channel.getOrganizations());
	logger.info('pretty', ChannelUtil.pretty(channel))
};
task();
