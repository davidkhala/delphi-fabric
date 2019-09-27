const globalConfig = require('./config/orgs.json');
const path = require('path');
const logger = require('./common/nodejs/logger').new('dockerode-bootstrap');
const peerUtil = require('./common/nodejs/peer');
const {
	runCouchDB,
	runCA,
	runKafka, runZookeeper,
	runPeer, runOrderer,
	chaincodeClean, fabricImagePull
} = require('./common/nodejs/fabric-dockerode');
const {CryptoPath} = require('./common/nodejs/path');
const {dockerode} = require('./common/nodejs/helper');

const {
	containerDelete, volumeCreateIfNotExist, networkCreateIfNotExist,
	volumeRemove, prune: {system: pruneLocalSystem}
} = dockerode.util;
const {homeResolve, fsExtra} = require('./common/nodejs');
const MSPROOT = homeResolve(globalConfig.docker.volumes.MSPROOT);
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX);
const {docker: {fabricTag, caTag, network, thirdPartyTag}, TLS} = globalConfig;

const BinManager = require('./common/nodejs/binManager');

exports.runOrderers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, toStop) => {
	const {orderer: {type, genesis_block: {file: BLOCK_FILE}}} = globalConfig;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	const imageTag = fabricTag;
	const {MSPROOT} = peerUtil.container;
	const cryptoType = 'orderer';

	const toggle = async ({orderer, domain, port, mspid}, OrdererType, stateVolume, operations) => {
		const cryptoPath = new CryptoPath(MSPROOT, {
			orderer: {org: domain, name: orderer}
		});

		const {ordererHostName} = cryptoPath;
		const container_name = ordererHostName;
		const configPath = cryptoPath.MSP(cryptoType);

		if (toStop) {
			await containerDelete(container_name);
		} else {
			const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;

			await runOrderer({
				container_name, imageTag, port, network,
				BLOCK_FILE, CONFIGTXVolume,
				msp: {
					id: mspid,
					configPath,
					volumeName: MSPROOTVolume
				},
				OrdererType,
				tls, stateVolume
			}, operations);
		}
	};
	if (type === 'solo') {
		const ordererConfig = globalConfig.orderer.solo;
		const {orgName: domain, mspid, portHost: port, operations} = ordererConfig;
		const orderer = ordererConfig.container_name;
		let {stateVolume} = ordererConfig;
		if (stateVolume) {
			stateVolume = homeResolve(stateVolume);
		}
		await toggle({orderer, domain, port, mspid}, type, stateVolume, operations);
	} else {
		const ordererOrgs = globalConfig.orderer[type].orgs;
		for (const [domain, ordererOrgConfig] of Object.entries(ordererOrgs)) {
			const {mspid} = ordererOrgConfig;
			for (const [orderer, ordererConfig] of Object.entries(ordererOrgConfig.orderers)) {
				let {stateVolume} = ordererConfig;
				if (stateVolume) {
					stateVolume = homeResolve(stateVolume);
				}
				const {portHost, operations} = ordererConfig;
				await toggle({orderer, domain, port: portHost, mspid}, type, stateVolume, operations);
			}
		}
	}
};

exports.volumesAction = async (toStop) => {
	for (const Name in globalConfig.docker.volumes) {
		if (toStop) {
			await volumeRemove(Name);
			continue;
		}
		const path = homeResolve(globalConfig.docker.volumes[Name]);
		await volumeCreateIfNotExist({Name, path});
	}
};
exports.runPeers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, toStop) => {
	const imageTag = fabricTag;
	const orgsConfig = globalConfig.orgs;


	for (const domain in orgsConfig) {
		const orgConfig = orgsConfig[domain];
		const peersConfig = orgConfig.peers;

		const {mspid} = orgConfig;
		for (const peerIndex in peersConfig) {
			const peerConfig = peersConfig[peerIndex];
			const {container_name, port, couchDB, operations} = peerConfig;
			let {stateVolume} = peerConfig;
			if (stateVolume) {
				stateVolume = homeResolve(stateVolume);
			}
			if (toStop) {
				if (couchDB) {
					await containerDelete(couchDB.container_name);
				}
				await containerDelete(container_name);
				continue;
			}

			const cryptoPath = new CryptoPath(peerUtil.container.MSPROOT, {
				peer: {
					org: domain, name: `peer${peerIndex}`
				}
			});
			const {peerHostName} = cryptoPath;

			const cryptoType = 'peer';
			const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;

			const type = 'peer';
			const configPath = cryptoPath.MSP(type);
			if (couchDB) {
				const {container_name, port} = couchDB;
				await runCouchDB({imageTag: thirdPartyTag, container_name, port, network});
			}
			await runPeer({
				container_name, port, imageTag, network,
				peerHostName, tls,
				msp: {
					id: mspid,
					volumeName: volumeName.MSPROOT,
					configPath
				}, couchDB, stateVolume
			}, operations);

		}

	}
};

exports.runCAs = async (toStop) => {
	const {orderer: {type}, orgs: peerOrgsConfig} = globalConfig;

	const imageTag = caTag;

	const toggle = async ({container_name, port, Issuer}) => {

		if (toStop) {
			await containerDelete(container_name);
		} else {
			await runCA({container_name, port, network, imageTag, TLS, Issuer});
		}
	};
	if (type === 'solo') {
		const {ca: {portHost: port}, orgName} = globalConfig.orderer.solo;
		const container_name = `ca.${orgName}`;
		const Issuer = {CN: orgName};
		await toggle({container_name, port, Issuer});
	} else {
		for (const [ordererOrg, ordererOrgConfig] of Object.entries(globalConfig.orderer[type].orgs)) {
			const {portHost: port} = ordererOrgConfig.ca;
			const container_name = `ca.${ordererOrg}`;
			const Issuer = {CN: ordererOrg};
			await toggle({container_name, port, Issuer});
		}
	}

	for (const [orgName, orgConfig] of Object.entries(peerOrgsConfig)) {
		const {ca: {portHost: port}} = orgConfig;
		const container_name = `ca.${orgName}`;
		const Issuer = {CN: orgName};
		await toggle({container_name, port, Issuer});
	}
};

exports.runZookeepers = async (toStop) => {
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const imageTag = thirdPartyTag;
	for (const zookeeper in zkConfigs) {
		const zkConfig = zkConfigs[zookeeper];
		const {MY_ID} = zkConfig;
		if (toStop) {
			await containerDelete(zookeeper);
		} else {
			await runZookeeper({
				container_name: zookeeper, MY_ID, imageTag, network
			}, zkConfigs);
		}
	}
};
exports.runKafkas = async (toStop) => {
	const kafkaConfigs = globalConfig.orderer.kafka.kafkas;
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const zookeepers = Object.keys(zkConfigs);
	const {N, M} = globalConfig.orderer.kafka;
	const imageTag = thirdPartyTag;

	for (const kafka in kafkaConfigs) {
		const kafkaConfig = kafkaConfigs[kafka];
		const {BROKER_ID} = kafkaConfig;
		if (toStop) {
			await containerDelete(kafka);
		} else {
			await runKafka({
				container_name: kafka, network, imageTag, BROKER_ID
			}, zookeepers, {N, M});
		}

	}
};
exports.down = async () => {
	const {orderer: {type}} = globalConfig;

	const toStop = true;
	try {
		await exports.runCAs(toStop);

		await exports.runPeers(undefined, toStop);
		await exports.runOrderers(undefined, toStop);
		if (type === 'kafka') {
			await exports.runKafkas(toStop);
			await exports.runZookeepers(toStop);
		}

		await pruneLocalSystem();
		await chaincodeClean(true);
		await exports.volumesAction(toStop);

		fsExtra.emptyDirSync(MSPROOT);
		logger.info(`[done] clear MSPROOT ${MSPROOT}`);
		fsExtra.emptyDirSync(CONFIGTX);
		logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);


		const binManager = new BinManager();

		await binManager.configtxlator('down');
	} catch (err) {
		logger.error(err);
		process.exit(1);
	}
	logger.debug('[done] down');
};

exports.up = async () => {
	try {

		await fabricImagePull({fabricTag, thirdPartyTag});

		const binManager = new BinManager();
		await binManager.configtxlator('start');

		await networkCreateIfNotExist({Name: network});

		const {orderer: {type}} = globalConfig;
		await exports.volumesAction();
		await exports.runCAs();

		if (type === 'kafka') {
			await exports.runZookeepers();
			await exports.runKafkas();
		}
		await require('./config/caCryptoGen').genAll();

		const PROFILE_BLOCK = globalConfig.orderer.genesis_block.profile;
		const configtxFile = path.resolve(__dirname, 'config', 'configtx.yaml');
		require('./config/configtx.js').gen({MSPROOT, PROFILE_BLOCK, configtxFile});


		const BLOCK_FILE = globalConfig.orderer.genesis_block.file;
		fsExtra.ensureDirSync(CONFIGTX);
		await binManager.configtxgen(PROFILE_BLOCK, configtxFile).genBlock(path.resolve(CONFIGTX, BLOCK_FILE));

		const channelsConfig = globalConfig.channels;
		for (const [channelName, channelConfig] of Object.entries(channelsConfig)) {
			const channelFile = path.resolve(CONFIGTX, channelConfig.file);
			await binManager.configtxgen(channelName, configtxFile, channelName).genChannel(channelFile);
		}


		await exports.runOrderers();

		await exports.runPeers();

	} catch (err) {
		logger.error(err);
		process.exit(1);
	}

	logger.debug('[done] up');

};
