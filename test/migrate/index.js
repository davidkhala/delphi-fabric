const {ChannelConfig: {channelUpdate, ConfigFactory}, Channel: ChannelUtil, Signature: {signs}, homeResolve} = require('../../common/nodejs');
const helper = require('../../app/helper');
const logger = helper.getLogger('kafka migrate: maintain mode');
process.env.binPath = helper.projectResolve('common/bin');

// peer is not used since peer could not get latest config during maintenance
const channelUpdateTest = async (channel, orderer, configChangeCallback, alternativeClient, signers = [channel._clientContext]) => {
	const signatureCollector = async (proto) => {
		return signs(signers, proto);
	};
	await channelUpdate(channel, orderer, configChangeCallback, signatureCollector, {viaServer: false, client: alternativeClient});
};
const maintenanceTest = async (channel, orderer, toMaintenance) => {

	const configChangeCallback = (original_config) => {
		const config = new ConfigFactory(original_config);
		return config.maintenanceMode(toMaintenance).build();
	};

	await channelUpdateTest(channel, orderer, configChangeCallback);
};
const getConsenters = () => {
	const Consenters = [];
	const globalConfig = require('../../config/orgs');
	const {CryptoPath} = require('../../common/nodejs/path');
	const MSPROOT = homeResolve(globalConfig.docker.volumes.MSPROOT);

	for (const [ordererOrgName, ordererOrgConfig] of Object.entries(globalConfig.orderer.etcdraft.orgs)) {
		for (const ordererName in ordererOrgConfig.orderers) {
			const ordererCryptoPath = new CryptoPath(MSPROOT, {
				orderer: {
					org: ordererOrgName, name: ordererName
				}
			});


			const {cert} = ordererCryptoPath.TLSFile('orderer');
			const host = `${ordererName}.${ordererOrgName}`;
			const consenter = {host, client_tls_cert: cert, server_tls_cert: cert}; // only accept TLS cert
			Consenters.push(consenter);
		}
	}
	return Consenters;
};
const consenters = getConsenters();

const toRaftTest = async (channel, orderer) => {
	const configChangeCallback = (original_config) => {
		const config = new ConfigFactory(original_config);
		config.setConsensusType('etcdraft');
		config.setConsensusMetadata(consenters);
		return config.build();
	};

	await channelUpdateTest(channel, orderer, configChangeCallback);
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
			await maintenanceTest(systemChannel, orderer, true);
			break;
		case 2:
			logger.debug(`${process.env.taskID}: migrate appChannel to STATE_MAINTENANCE`);
			await maintenanceTest(appChannel, orderer, true);
			break;
		case 3:
			logger.debug(`${process.env.taskID}: migrate to STATE_NORMAL`);
			await maintenanceTest(systemChannel, orderer);
			break;
		case 4:
			logger.debug(`${process.env.taskID}: migrate appChannel to STATE_NORMAL`);
			await maintenanceTest(appChannel, orderer, false);
			break;
		case 5:
			logger.debug(`${process.env.taskID}: migrate sysChannel to RAFT`);
			await toRaftTest(systemChannel, orderer);
			break;
	}


};
task();
