const {ChannelConfig: {channelUpdate, ConfigFactory}, Channel, Signature: {signs}, homeResolve, sleep} = require('../../common/nodejs');
const {OrdererType} = require('../../common/nodejs/constants');
const helper = require('../../app/helper');
const logger = helper.getLogger('kafka migrate to etcdraft');
process.env.binPath = helper.projectResolve('common/bin');

// peer is not used since peer could not get latest config during maintenance
const channelUpdateTest = async (channel, orderer, configChangeCallback, alternativeClient, signers = [channel._clientContext]) => {
	const signatureCollector = async (proto) => {
		return signs(signers, proto);
	};
	await channelUpdate(channel, orderer, configChangeCallback, signatureCollector, {viaServer: false, client: alternativeClient});
};
const maintenanceTest = async (channel, orderer, toMaintenance) => {
	logger.debug('target orderer', orderer.getName());

	const configChangeCallback = (original_config) => {
		const config = new ConfigFactory(original_config);
		return config.maintenanceMode(toMaintenance).build();
	};

	await channelUpdateTest(channel, orderer, configChangeCallback);
};

const toRaftTest = async (channel, orderer) => {

	const consenters = [];
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
			consenters.push(consenter);
		}
	}
	const configChangeCallback = (original_config) => {
		const config = new ConfigFactory(original_config);
		config.setConsensusType(OrdererType.etcdraft);
		config.setConsensusMetadata(consenters);
		return config.build();
	};

	await channelUpdateTest(channel, orderer, configChangeCallback);
};

// 1. stop orderers
// 2. stop kafkas
// 3. stop zookeepers
// 4. restart orderers only the ordering service nodes.
const pruneKafka = async () => {
	const dockerHandler = require('../../dockerode-bootstrap');
	await dockerHandler.runOrderers(undefined, true);
	await dockerHandler.runKafkas(true);
	await dockerHandler.runZookeepers(true);
	await dockerHandler.runOrderers(undefined, undefined, OrdererType.etcdraft);
};
const task = async (taskID = parseInt(process.env.taskID)) => {
	const ordererClient = await helper.getOrgAdmin(undefined, 'orderer');
	const systemChannel = helper.prepareChannel('testchainid', ordererClient);
	const orderers = await Channel.getOrderers(systemChannel, true);

	const appChannel = helper.prepareChannel('allchannel', ordererClient);
	switch (taskID) {
		case 1:
			logger.debug(`${taskID}: migrate sysChannel to STATE_MAINTENANCE`);
			await maintenanceTest(systemChannel, orderers[0], true);
			break;
		case 2:
			logger.debug(`${taskID}: migrate appChannel to STATE_MAINTENANCE`);
			await maintenanceTest(appChannel, orderers[0], true);
			break;
		case 3:
			logger.debug(`${taskID}: migrate to STATE_NORMAL`);
			await maintenanceTest(systemChannel, orderers[0]);
			break;
		case 4:
			logger.debug(`${taskID}: migrate appChannel to STATE_NORMAL`);
			await maintenanceTest(appChannel, orderers[0], false);
			break;
		case 5:
			logger.debug(`${taskID}: migrate sysChannel to RAFT`);
			await toRaftTest(systemChannel, orderers[0]);
			break;
		case 6:
			logger.debug(`${taskID}: migrate appChannel to RAFT`);
			await toRaftTest(appChannel, orderers[0]);
			break;
		case 7:
			logger.debug(`${taskID}: prune kafka and restart`);
			await pruneKafka();
			break;
		case 8:
			logger.debug(`${taskID}: run diagnose test`);
			require('../../cc/golang/diagnose/test');
			break;
	}
};
const e2eTask = async () => {
	await task(1);
	await task(2);
	await task(5);
	await task(6);
	await task(7);
	await sleep(2000);
	await task(3);
	await task(4);
	await task(8);

};
e2eTask();