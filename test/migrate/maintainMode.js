// exports.channelUpdate = async (channel, orderer, peer, mspCB, signatureCollectCB, client = channel._clientContext) => {
const {Configtxlator: {channelUpdate, ConfigFactory}, Channel: ChannelUtil, Signature: {signs}} = require('../../common/nodejs');
const helper = require('../../app/helper');
process.env.binPath = helper.projectResolve('common/bin');

const channelUpdateTest = async (channel, orderer, toMaintenance, viaServer) => {
	const signerClient = channel._clientContext;
	const signatureCollector = async (proto) => {
		const signatures = signs([signerClient], proto);
		return signatures;
	};

	const configChangeCallback = (original_config) => {
		const config = new ConfigFactory(original_config);
		return config.maintenanceMode(toMaintenance).build();
	};

	await channelUpdate(channel, orderer, configChangeCallback, signatureCollector, {viaServer});
};
const task = async () => {
	const client = await helper.getOrgAdmin(undefined, 'orderer');
	const channel = helper.prepareChannel('testchainid', client);
	const orderers = await ChannelUtil.getOrderers(channel, true);
	const orderer = orderers[0];
	await channelUpdateTest(channel, orderer);
	await channelUpdateTest(channel, orderer, true, true);

};
task();