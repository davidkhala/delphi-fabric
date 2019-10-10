const {ChannelConfig: {channelUpdate, ConfigFactory}, Channel: ChannelUtil, Signature: {signs}, sleep} = require('../../common/nodejs');
const helper = require('../../app/helper');
const logger = helper.getLogger('kafka migrate: maintain mode');
process.env.binPath = helper.projectResolve('common/bin');

// peer is not used since peer could not get latest config during maintenance
const channelUpdateTest = async (channel, orderer, toMaintenance, viaServer, signers = [channel._clientContext], alternativeClient) => {
	const signatureCollector = async (proto) => {
		const signatures = signs(signers, proto);
		return signatures;
	};

	const configChangeCallback = (original_config) => {
		const config = new ConfigFactory(original_config);
		return config.maintenanceMode(toMaintenance).build();
	};

	await channelUpdate(channel, orderer, configChangeCallback, signatureCollector, {viaServer, client: alternativeClient});
};
const task = async () => {
	const ordererClient = await helper.getOrgAdmin(undefined, 'orderer');
	const systemChannel = helper.prepareChannel('testchainid', ordererClient);
	const orderers = await ChannelUtil.getOrderers(systemChannel, true);
	const orderer = orderers[0];
	logger.debug('target orderer', orderer.getName());

	const peerClient = await helper.getOrgAdmin('icdd', 'peer');
	const peerClient1 = await helper.getOrgAdmin('astri.org', 'peer');

	const appChannel = helper.prepareChannel('allchannel', ordererClient);
	switch (parseInt(process.env.taskID)) {
		case 1:
			logger.debug(`${process.env.taskID}: migrate sysChannel to STATE_MAINTENANCE`);
			await channelUpdateTest(systemChannel, orderer, true, true);
			break;
		case 2:
			logger.debug(`${process.env.taskID}: migrate appChannel to STATE_MAINTENANCE`);
			await channelUpdateTest(appChannel, orderer, true, false, [peerClient, peerClient1, ordererClient], ordererClient);
			break;
		case 3:
			logger.debug(`${process.env.taskID}: migrate to STATE_NORMAL`);
			await channelUpdateTest(systemChannel, orderer);
			break;
		case 4:
			logger.debug(`${process.env.taskID}: migrate appChannel to STATE_NORMAL`);
			await channelUpdateTest(appChannel, orderer, false, false, [peerClient, peerClient1, ordererClient], ordererClient);
			break;
	}


};
task();
