const {Configtxlator: {channelUpdate, ConfigFactory}, Channel: ChannelUtil, Signature: {signs}, sleep} = require('../../common/nodejs');
const helper = require('../../app/helper');
const logger = helper.getLogger('kafka migrate: maintain mode');
process.env.binPath = helper.projectResolve('common/bin');

const channelUpdateTest = async (channel, orderer, toMaintenance, viaServer, peer, signers = [channel._clientContext], alternativeClient) => {
	const signatureCollector = async (proto) => {
		const signatures = signs(signers, proto);
		return signatures;
	};

	const configChangeCallback = (original_config) => {
		const config = new ConfigFactory(original_config);
		return config.maintenanceMode(toMaintenance).build();
	};

	await channelUpdate(channel, orderer, configChangeCallback, signatureCollector, {viaServer, peer, client: alternativeClient});
};
const task = async () => {
	const ordererClient = await helper.getOrgAdmin(undefined, 'orderer');
	const systemChannel = helper.prepareChannel('testchainid', ordererClient);
	const orderers = await ChannelUtil.getOrderers(systemChannel, true);
	const orderer = orderers[0];

	logger.debug('T1: migrate sysChannel to STATE_MAINTENANCE');
	await channelUpdateTest(systemChannel, orderer, true, true);

	const peerClient = await helper.getOrgAdmin('icdd', 'peer');
	const peerClient1 = await helper.getOrgAdmin('astri.org', 'peer');
	const appChannel = helper.prepareChannel('allchannel', peerClient);
	const peer = helper.newPeer(0, 'icdd');
	logger.debug('T2: migrate appChannel to STATE_MAINTENANCE');
	await channelUpdateTest(appChannel, orderer, true, false, peer, [peerClient, peerClient1, ordererClient], ordererClient);

	await sleep(10000);
	logger.debug('T3: migrate to STATE_NORMAL');
	await channelUpdateTest(systemChannel, orderer);
	logger.debug('T4: migrate appChannel to STATE_NORMAL');
	await channelUpdateTest(appChannel, orderer, false, false, peer, [peerClient, peerClient1, ordererClient], ordererClient);

};
task();