const channelName = 'allchannel';
const helper = require('../app/helper');
const org = 'astri.org';
const logger = helper.getLogger('test:channel:initialize');
const ServiceDiscoveryUtil = require('../common/nodejs/serviceDiscovery');

const task = async () => {
	const client = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client);
	logger.info(channel.toString());
	const peer = helper.newPeer(0, org);
	await ServiceDiscoveryUtil.initialize(channel, peer);
	logger.info('after init', channel.toString());// NOTE:can refresh orderers in network
};
task();
