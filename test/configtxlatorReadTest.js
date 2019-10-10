const helper = require('../app/helper');
const testHelper = require('./testHelper');
process.env.binPath = helper.projectResolve('common/bin');
const ChannelConfig = require('../common/nodejs/channelConfig');
const channelName = 'allchannel';
const logger = helper.getLogger('test:configtxlator');
const appChannel = async (viaServer) => {
	try {
		const peerOrg = helper.randomOrg('peer');
		const peerClient = await helper.getOrgAdmin(peerOrg, 'peer'); // only peer user can read channel
		const channel = helper.prepareChannel(channelName, peerClient);
		const peer = helper.newPeer(0, peerOrg);
		const {original_config} = await ChannelConfig.getChannelConfigReadable(channel, peer, viaServer);

		testHelper.writeArtifacts(original_config, `${channelName}${viaServer ? '-viaServer' : ''}.json`);
	} catch (e) {
		logger.error(e);
	}
};
const appChannelByOrderer = async (viaServer) => {
	try {
		const ordererOrg = helper.randomOrg('orderer');
		const ordererClient = await helper.getOrgAdmin(ordererOrg, 'orderer'); // only peer user can read channel
		const channel = helper.prepareChannel(channelName, ordererClient);
		const {original_config} = await ChannelConfig.getChannelConfigReadable(channel, undefined, viaServer);

		testHelper.writeArtifacts(original_config, `${channelName}-viaOrderer${viaServer ? '-viaServer' : ''}.json`);
	} catch (e) {
		logger.error(e);
	}
};
const systemChannel = async (viaServer) => {
	try {
		const ordererOrg = helper.randomOrg('orderer');
		const ordererClient = await helper.getOrgAdmin(ordererOrg, 'orderer');
		const channel = helper.prepareChannel(undefined, ordererClient);
		const {original_config} = await ChannelConfig.getChannelConfigReadable(channel, undefined, viaServer);

		testHelper.writeArtifacts(original_config, `testchainid${viaServer ? '-viaServer' : ''}.json`);
	} catch (e) {
		logger.error(e);
	}
};
const flow = async () => {
	await systemChannel();
	await appChannel();
	await systemChannel();
	await appChannel(true);
	await systemChannel(true);
	await appChannelByOrderer();
};
flow();



