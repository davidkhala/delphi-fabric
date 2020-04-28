/**
 *  @typedef {Object} PeerQueryRequest
 * @property {Peer | string} target - The {@link Peer} object or peer name to
 *           use for the service discovery request
 * @property {boolean} useAdmin - Optional. Indicates that the admin credentials
 *           should be used in making this call to the peer. An administrative
 *           identity must have been loaded by a connection profile or by
 *           using the 'setAdminSigningIdentity' method.
 */
const helper = require('../app/helper');
const logger = helper.getLogger('test:serviceDiscovery');
const {discoveryChaincodeInterestBuilder} = require('../app/chaincodeHelper');
const {globalPeers, initialize, discover, discoverPretty} = require('../common/nodejs/serviceDiscovery');
const ChannelUtil = require('../common/nodejs/channel');
const OrdererUtil = require('../common/nodejs/admin/orderer');
const {containerDelete} = require('../common/nodejs/helper').dockerode.util;
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
	const peer = helper.newPeer(0, org);
	const discoveries = await globalPeers(client, peer);
	logger.debug(discoveries);
};
const discoverOrderer = async () => {
	const org = 'icdd';
	const channelName = 'allchannel';
	const client = await helper.getOrgAdmin(org, 'peer');
	const channel = ChannelUtil.new(client, channelName);
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
	const client = await helper.getOrgAdmin(org, 'peer');
	const channel = ChannelUtil.new(client, channelName);
	const peer = helper.newPeer(0, org);
	const filter = Array.isArray(chaincodeIds) ? (chaincodeid) => chaincodeIds.includes(chaincodeid) : undefined;

	const interest = discoveryChaincodeInterestBuilder(filter);
	const result = await discover(channel, peer, interest);
	return discoverPretty(result);
};
const task = async () => {
	// await deletePeer();
	await peerList();
	// await deleteOrderer();
	await discoverOrderer();
	// const discoverChannelResult = await discoverChannel(['master']);
	// logger.debug('discoverChannel', discoverChannelResult);

};
task();
