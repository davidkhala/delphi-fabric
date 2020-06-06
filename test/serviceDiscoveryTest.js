// TODO migration
const helper = require('../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:serviceDiscovery');
// const {globalPeers, initialize, discover, discoverPretty} = require('../common/nodejs/serviceDiscovery');
const SlimDiscoveryService = require('../common/nodejs/admin/discovery');
const {getIdentityContext} = require('../common/nodejs/admin/user');
const {containerDelete} = require('khala-dockerode/dockerode-util');
const {resultParser} = require('../common/nodejs/formatter/discovery');
describe('change container', () => {
	it('deletePeer', async () => {
		const containerName = 'peer0.astri.org';
		await containerDelete(containerName);
	});
	it('deleteOrderer', async () => {
		const ordererContainer = 'orderer0.icdd.astri.org';
		await containerDelete(ordererContainer);
	});
});
describe('discovery', () => {
	const org = 'icdd';
	const peer = helper.newPeer(0, org);
	const slimDiscoveryService = new SlimDiscoveryService('allchannel', peer.discoverer);

	const user = helper.getOrgAdmin(org, 'peer');
	const identityContext = getIdentityContext(user);
	beforeEach(async () => {
		await peer.connect();
	});
	const peersReader = (members) => {
		for (const [mspid, peers] of Object.entries(members)) {
			for (const peerConfig of peers) {
				const peerConfig1 = SlimDiscoveryService.ParsePeerResult(peerConfig);
				logger.debug(peerConfig1);
			}
		}
	};
	it('config', async () => {
		slimDiscoveryService.build(identityContext, {config: true});
		const discoveries = await slimDiscoveryService.send();
		const trimmedResult = resultParser(discoveries);
		logger.debug(trimmedResult);
		// peersReader(trimmedResult.members);
	});
	it('local: return peers only', async () => {
		slimDiscoveryService.build(identityContext, {local: true});
		const discoveries = await slimDiscoveryService.send();
		logger.debug(resultParser(discoveries));
	});
	it('local & config', async () => {
		slimDiscoveryService.build(identityContext, {local: true, config: true});
		const discoveries = await slimDiscoveryService.send();
		logger.debug(resultParser(discoveries));
	});

});

// const discoverOrderer = async () => {
// 	const org = 'icdd';
// 	const channelName = 'allchannel';
// 	const client = await helper.getOrgAdmin(org, 'peer');
// 	const channel = ChannelUtil.new(client, channelName);
// 	const peer = helper.newPeer(0, org);
// 	await initialize(channel, peer);
// 	const orderers = channel.getOrderers();
//
// 	for (const orderer of orderers) {
// 		const localhostOrderer = helper.toLocalhostOrderer(orderer);//TODO WIP
// 		const connectResult = await OrdererUtil.ping(localhostOrderer);
// 		logger.info('connectResult ', connectResult);
// 	}
// };
// const discoverChannel = async (chaincodeIds) => {
// 	const org = 'icdd';
// 	const channelName = 'allchannel';
// 	const client = await helper.getOrgAdmin(org, 'peer');
// 	const channel = ChannelUtil.new(client, channelName);
// 	const peer = helper.newPeer(0, org);
// 	const filter = Array.isArray(chaincodeIds) ? (chaincodeid) => chaincodeIds.includes(chaincodeid) : undefined;
//
// 	const interest = discoveryChaincodeInterestBuilder(filter);
// 	const result = await discover(channel, peer, interest);
// 	return discoverPretty(result);
// };
// const task = async () => {
// 	// await deletePeer();
// 	await peerList();
// 	// await deleteOrderer();
// 	await discoverOrderer();
// 	// const discoverChannelResult = await discoverChannel(['master']);
// 	// logger.debug('discoverChannel', discoverChannelResult);
//
// };
// // task();
