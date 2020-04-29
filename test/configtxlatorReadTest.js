const helper = require('../app/helper');
const testHelper = require('./testHelper');
process.env.binPath = helper.projectResolve('common/bin');
const ChannelConfig = require('../common/nodejs/channelConfig');
const channelName = 'allchannel';
const logger = require('khala-logger/log4js').consoleLogger('test:configtxlator');
const appChannel = async (viaServer) => {
	try {
		const peerOrg = helper.randomOrg('peer');
		const peerClient = helper.getOrgAdmin(peerOrg, 'peer'); // only peer user can read channel
		const channel = helper.prepareChannel(channelName, peerClient);
		const peer = helper.newPeer(0, peerOrg);
		const {configJSON} = await ChannelConfig.getChannelConfigReadable(channel, {peer}, viaServer);

		testHelper.writeArtifacts(configJSON, `${channelName}${viaServer ? '-viaServer' : ''}.json`);
	} catch (e) {
		logger.error(e);
	}
};
const appChannelByOrderer = async (viaServer) => {
	try {
		const ordererOrg = helper.randomOrg('orderer');
		const ordererClient = helper.getOrgAdmin(ordererOrg, 'orderer'); // only peer user can read channel
		const channel = helper.prepareChannel(channelName, ordererClient);
		const orderer = helper.newOrderers()[0];
		const {configJSON} = await ChannelConfig.getChannelConfigReadable(channel, {orderer}, viaServer);

		testHelper.writeArtifacts(configJSON, `${channelName}-viaOrderer${viaServer ? '-viaServer' : ''}.json`);
	} catch (e) {
		logger.error(e);
	}
};
const systemChannel = async (viaServer) => {
	try {
		const ordererOrg = helper.randomOrg('orderer');
		const ordererClient = helper.getOrgAdmin(ordererOrg, 'orderer');
		const channel = helper.prepareChannel(undefined, ordererClient);
		const orderer = helper.newOrderers()[0];
		const {configJSON} = await ChannelConfig.getChannelConfigReadable(channel, {orderer}, viaServer);

		testHelper.writeArtifacts(configJSON, `testchainid${viaServer ? '-viaServer' : ''}.json`);
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



