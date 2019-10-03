const helper = require('../app/helper');
process.env.binPath = helper.projectResolve('common/bin');
const configtxlator = require('../common/nodejs/configtxlator');
const channelName = 'allchannel';
const {fsExtra} = require('../common/nodejs');
const logger = helper.getLogger('test:configtxlator');
const appChannel = async (viaServer) => {
	try {
		const peerOrg = helper.randomOrg('peer');
		const peerClient = await helper.getOrgAdmin(peerOrg, 'peer'); // only peer user can read channel
		const channel = helper.prepareChannel(channelName, peerClient);
		const peer = helper.newPeer(0, peerOrg);
		const {original_config} = await configtxlator.getChannelConfigReadable(channel, peer, viaServer);

		fsExtra.outputFileSync(`${channelName}${viaServer ? '-viaServer' : ''}.json`, original_config);
	} catch (e) {
		logger.error(e);
	}
};
const systemChannel = async (viaServer) => {
	try {
		const ordererOrg = helper.randomOrg('orderer');
		const ordererClient = await helper.getOrgAdmin(ordererOrg, 'orderer');
		const channel = helper.prepareChannel(undefined, ordererClient);
		const {original_config} = await configtxlator.getChannelConfigReadable(channel, undefined, viaServer);

		fsExtra.outputFileSync(`testchainid${viaServer ? '-viaServer' : ''}.json`, original_config);
	} catch (e) {
		logger.error(e);
	}
};
const flow = async () => {
	await appChannel();
	await systemChannel();
	await appChannel(true);
	await appChannel(true);
};
flow();



