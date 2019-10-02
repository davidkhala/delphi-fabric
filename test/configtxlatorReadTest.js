const helper = require('../app/helper');
process.env.binPath = helper.projectResolve('common/bin');
const configtxlator = require('../common/nodejs/configtxlator');
const channelName = 'allchannel';
const {fsExtra} = require('../common/nodejs');
const logger = helper.getLogger('test:configtxlator');
const appChannel = async () => {
	try {
		const peerOrg = helper.randomOrg('peer');
		const peerClient = await helper.getOrgAdmin(peerOrg, 'peer'); // only peer user can read channel
		const channel = helper.prepareChannel(channelName, peerClient);
		const peer = helper.newPeer(0, peerOrg);
		const {original_config} = await configtxlator.getChannelConfigReadable(channel, peer);

		fsExtra.outputFileSync(`${channelName}.json`, original_config);
	} catch (e) {
		logger.error(e);
	}
};
const systemChannel = async () => {
	try {
		const ordererOrg = helper.randomOrg('orderer');
		const ordererClient = await helper.getOrgAdmin(ordererOrg, 'orderer');
		const channel = helper.prepareChannel(undefined, ordererClient);
		const {original_config} = await configtxlator.getChannelConfigReadable(channel);

		fsExtra.outputFileSync('testchainid.json', original_config);
	} catch (e) {
		logger.error(e);
	}
};
const flow = async () => {
	await appChannel();
	await systemChannel();
};
flow();



