const globalConfig = require('./config/orgs.json');
const path = require('path');
const logger = require('./common/nodejs/logger').new('dockerode-bootstrap', true);
const peerUtil = require('./common/nodejs/peer');
const {OrdererType} = require('./common/nodejs/formatter/constants');
const {
	runCouchDB,
	runCA,
	runKafka, runZookeeper,
	runPeer, runOrderer,
	chaincodeClear, chaincodeImageClear, fabricImagePull
} = require('./common/nodejs/fabric-dockerode');
const {CryptoPath} = require('./common/nodejs/path');
const configConfigtx = require('./config/configtx.js');
const caCrypoGenUtil = require('./config/caCryptoGen');
const {
	containerDelete, volumeCreateIfNotExist, networkCreateIfNotExist,
	volumeRemove, prune: {system: pruneLocalSystem}
} = require('khala-dockerode/dockerode-util');
const {homeResolve, fsExtra} = require('khala-nodeutils/helper');
const MSPROOT = homeResolve(globalConfig.docker.volumes.MSPROOT);
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX);
const {docker: {fabricTag, caTag, network, thirdPartyTag}, TLS} = globalConfig;

const BinManager = require('./common/nodejs/binManager');

exports.runOrderers = async (volumeName = {
	CONFIGTX: 'CONFIGTX',
	MSPROOT: 'MSPROOT'
}, toStop, type = globalConfig.orderer.type) => {
	const {orderer: {genesis_block: {file: BLOCK_FILE}}} = globalConfig;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	const imageTag = fabricTag;
	// eslint-disable-next-line no-shadow
	const {MSPROOT} = peerUtil.container;
	const nodeType = 'orderer';

	const toggle = async ({orderer, domain, port, mspid}, ordererType, stateVolume, operations, metrics) => {
		const cryptoPath = new CryptoPath(MSPROOT, {
			orderer: {org: domain, name: orderer}
		});

		const {ordererHostName} = cryptoPath;
		const container_name = ordererHostName;
		const configPath = cryptoPath.MSP(nodeType);

		if (toStop) {
			await containerDelete(container_name);
		} else {
			const tls = TLS ? cryptoPath.TLSFile(nodeType) : undefined;

			await runOrderer({
				container_name, imageTag, port, network,
				BLOCK_FILE, CONFIGTXVolume,
				msp: {
					id: mspid,
					configPath,
					volumeName: MSPROOTVolume
				},
				ordererType,
				tls, stateVolume
			}, operations, metrics);
		}
	};
	const ordererOrgs = globalConfig.orderer[type].orgs;
	for (const [domain, ordererOrgConfig] of Object.entries(ordererOrgs)) {
		const {mspid} = ordererOrgConfig;
		for (const [orderer, ordererConfig] of Object.entries(ordererOrgConfig.orderers)) {
			let {stateVolume} = ordererConfig;
			if (stateVolume) {
				stateVolume = homeResolve(stateVolume);
			}
			const {portHost, operations, metrics} = ordererConfig;
			await toggle({orderer, domain, port: portHost, mspid}, type, stateVolume, operations, metrics);
		}
	}
};

exports.volumesAction = async (toStop) => {
	for (const Name in globalConfig.docker.volumes) {
		if (toStop) {
			await volumeRemove(Name);
			continue;
		}
		await volumeCreateIfNotExist({Name, path: homeResolve(globalConfig.docker.volumes[Name])});
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
			const {container_name, port, couchDB, operations, metrics} = peerConfig;
			if (!container_name) {
				logger.warn(`peer[${peerIndex}].${domain} will not run as docker container`);
				// this peer will not run in docker container
				continue;
			}
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
				// eslint-disable-next-line no-shadow
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
			}, operations, metrics);

		}

	}
};

exports.runCAs = async (toStop) => {
	const {orderer: {type}, orgs: peerOrgsConfig} = globalConfig;

	const imageTag = caTag;

	const toggle = async ({container_name, port, issuer}) => {

		if (toStop) {
			await containerDelete(container_name);
		} else {
			await runCA({container_name, port, network, imageTag, TLS, issuer});
		}
	};
	for (const [ordererOrg, ordererOrgConfig] of Object.entries(globalConfig.orderer[type].orgs)) {
		const {portHost: port} = ordererOrgConfig.ca;
		const container_name = `ca.${ordererOrg}`;
		const issuer = {CN: ordererOrg};
		await toggle({container_name, port, issuer});
	}

	for (const [orgName, orgConfig] of Object.entries(peerOrgsConfig)) {
		const {ca: {portHost: port}} = orgConfig;
		const container_name = `ca.${orgName}`;
		const issuer = {CN: orgName};
		await toggle({container_name, port, issuer});
	}
};

exports.runIntermediateCAs = async (toStop) => {
	const {orderer: {type}, orgs: peerOrgsConfig} = globalConfig;

	const toggle = async (org, orgConfig, nodeType) => {
		if (!orgConfig.intermediateCA) {
			return;
		}
		const parentHost = `ca.${org}`;
		const {portHost: parentPort} = orgConfig.ca;
		const container_name = `ca.intermediate.${org}`;
		const port = orgConfig.intermediateCA.portHost;
		/**
		 * @type {Issuer}
		 */
		const issuer = {CN: `intermediate.${org}`};

		if (toStop) {
			await containerDelete(container_name);
		} else {
			const {enrollmentID, enrollmentSecret} = await caCrypoGenUtil.genIntermediate(org, parentPort, nodeType);
			const intermediate = {host: parentHost, port: parentPort, enrollmentID, enrollmentSecret};
			await runCA({container_name, port, network, imageTag: caTag, TLS, issuer}, intermediate);
		}
	};

	for (const [ordererOrg, ordererOrgConfig] of Object.entries(globalConfig.orderer[type].orgs)) {
		await toggle(ordererOrg, ordererOrgConfig, 'orderer');
	}

	for (const [orgName, orgConfig] of Object.entries(peerOrgsConfig)) {
		await toggle(orgName, orgConfig, 'peer');
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
const down = async () => {
	const {orderer: {type}} = globalConfig;

	const toStop = true;
	await exports.runCAs(toStop);

	await exports.runPeers(undefined, toStop);
	await exports.runOrderers(undefined, toStop);
	if (type === OrdererType.kafka) {
		await exports.runKafkas(toStop);
		await exports.runZookeepers(toStop);
	}

	await pruneLocalSystem();
	await chaincodeClear();
	await chaincodeImageClear();
	await exports.volumesAction(toStop);

	fsExtra.emptyDirSync(MSPROOT);
	logger.info(`[done] clear MSPROOT ${MSPROOT}`);
	fsExtra.emptyDirSync(CONFIGTX);
	logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);
};

const up = async () => {

	await fabricImagePull({fabricTag, thirdPartyTag});

	const binManager = new BinManager();

	await networkCreateIfNotExist({Name: network});

	const {orderer: {type}} = globalConfig;
	await exports.volumesAction();
	await exports.runCAs();

	if (type === OrdererType.kafka) {
		await exports.runZookeepers();
		await exports.runKafkas();
	}
	await caCrypoGenUtil.genAll();

	const PROFILE_BLOCK = globalConfig.orderer.genesis_block.profile;
	const configtxFile = path.resolve(__dirname, 'config', 'configtx.yaml');
	configConfigtx.gen({MSPROOT, PROFILE_BLOCK, configtxFile});


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
};
const task = async () => {
	const {action} = process.env;
	try {
		switch (action) {
			case 'down':
				await down();
				logger.debug('[done] down');
				break;
			case 'up':
				await up();
				logger.debug('[done] up');
				break;
			default:
		}
	} catch (err) {
		logger.error(err);
		process.exit(1);
	}

};
task();