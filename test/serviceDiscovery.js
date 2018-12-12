/**
 *  @typedef {Object} PeerQueryRequest
 * @property {Peer | string} target - The {@link Peer} object or peer name to
 *           use for the service discovery request
 * @property {boolean} useAdmin - Optional. Indicates that the admin credentials
 *           should be used in making this call to the peer. An administrative
 *           identity must have been loaded by a connection profile or by
 *           using the 'setAdminSigningIdentity' method.
 */
const Logger = require('../common/nodejs/logger');
const logger = Logger.new('test:serviceDiscovery', true);
Logger.setGlobal(true);
const helper = require('../app/helper');
const {globalPeers, getDiscoveryResults} = require('../common/nodejs/serviceDiscovery');
const ChannelUtil = require('../common/nodejs/channel');
const OrdererUtil = require('../common/nodejs/orderer');
const {containerDelete} = require('../common/docker/nodejs/dockerode-util');
const deletePeer = async () => {
	const containerName = 'peer0.ASTRI.org';
	await containerDelete(containerName);
};
const deleteOrderer = async () => {
	const ordererContainer = 'orderer0.ICDD.ASTRI.org';
	await containerDelete(ordererContainer);
};
const peerList = async () => {
	const org = 'icdd';
	const client = await helper.getOrgAdmin(org, 'peer');
	const peer = helper.newPeers([0], org)[0];
	const discoveries = await globalPeers(client, peer);
	logger.debug(discoveries.pretty);
};
const discoverOrderer = async () => {
	const org = 'icdd';
	const channelName = 'allchannel';
	const client = await helper.getOrgAdmin(org, 'peer');
	const channel = ChannelUtil.new(client, channelName);
	const peer = helper.newPeers([0], org)[0];
	await ChannelUtil.initialize(channel, peer, {asLocalhost: true});
	const orderers = channel.getOrderers();//FIXME sdk: only one peer is here
	logger.debug(orderers);
	const discoveryResult = await getDiscoveryResults(channel);
	logger.debug('discoveryResult', discoveryResult.orderers.ICDDMSP.endpoints);

	for (const [name, orderer] of Object.entries(orderers)) {
		const connectResult = await OrdererUtil.connect(orderer);
		logger.debug('connectResult ', name, connectResult);//TODO found all failed, think of use discoveryResults
	}
};
const task = async () => {
	// await deletePeer();
	// await peerList();
	// await deleteOrderer();
	await discoverOrderer();
};
task();
