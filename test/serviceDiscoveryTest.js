const helper = require('../app/helper');
const logger = helper.getLogger('test:serviceDiscovery');
const {discoveryChaincodeInterestBuilder} = require('../app/chaincodeHelper');
const {globalPeers, initialize, discover, discoverPretty} = require('../common/nodejs/serviceDiscovery');
const OrdererUtil = require('../common/nodejs/builder/orderer');
const {containerDelete} = require('khala-dockerode/dockerode-util');
const deletePeer = async () => {
	const containerName = 'peer0.astri.org';
	await containerDelete(containerName);
};
const deleteOrderer = async () => {
	const ordererContainer = 'orderer0.icdd.astri.org';
	await containerDelete(ordererContainer);
};
const peerList = async () => {
	const org = 'icdd';
	const client = helper.getOrgAdmin(org, 'peer');
	const peer = helper.newPeer(0, org);
	const discoveries = await globalPeers(client, peer);
	logger.debug(discoveries);
};
const discoverOrderer = async () => {
	const org = 'icdd';
	const channelName = 'allchannel';
	const client = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client);
	const peer = helper.newPeer(0, org);
	await initialize(channel, peer);
	const orderers = channel.getOrderers();

	for (const orderer of orderers) {
		const localhostOrderer = helper.toLocalhostOrderer(orderer);
		const connectResult = await OrdererUtil.ping(localhostOrderer);
		logger.info('connectResult ', connectResult);
	}
};
const discoverChannel = async (chaincodeIds) => {
	const org = 'icdd';
	const channelName = 'allchannel';
	const client = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client);
	const peer = helper.newPeer(0, org);
	const filter = Array.isArray(chaincodeIds) ? (chaincodeid) => chaincodeIds.includes(chaincodeid) : undefined;

	const interest = discoveryChaincodeInterestBuilder(filter);
	const result = await discover(channel, peer, interest);
	return discoverPretty(result);
};
const task = async () => {
	switch (parseInt(process.env.taskID)) {
		case 0:
			await deletePeer();
			break;
		case 1:
			await deleteOrderer();
			break;
		case 2: {
			const discoverChannelResult = await discoverChannel(['master']);
			logger.debug('discoverChannel', discoverChannelResult);
		}
			break;
		default:
			await peerList();
			await discoverOrderer();
	}


};
task();
