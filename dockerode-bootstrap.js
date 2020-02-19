const globalConfig = require('./config/orgs.json');
const path = require('path');
const logger = require('./common/nodejs/logger').new('dockerode-bootstrap', true);
const peerUtil = require('./common/nodejs/peer');
const {
	runCouchDB, runCA, runPeer, runOrderer, chaincodeClean, fabricImagePull
} = require('./common/nodejs/fabric-dockerode');
const {CryptoPath} = require('./common/nodejs/path');

const {
	containerDelete, volumeCreateIfNotExist, networkCreateIfNotExist,
	volumeRemove, prune: {system: pruneLocalSystem}
} = require('khala-dockerode/dockerode-util');
const {homeResolve, fsExtra} = require('khala-nodeutils/helper');
const MSPROOT = homeResolve(globalConfig.docker.volumes.MSPROOT);
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX);
const {docker: {fabricTag, caTag, network, thirdPartyTag}, TLS} = globalConfig;

const {genBlock, genChannel} = require('./common/nodejs/binManager');

exports.runOrderers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, toStop) => {
	const {orderer: {type, genesis_block: {file: BLOCK_FILE}}} = globalConfig;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	const imageTag = fabricTag;
	const {MSPROOT} = peerUtil.container;
	const cryptoType = 'orderer';
	const orderers = [];

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
exports.runPeers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, tostop) => {
	const imageTag = fabricTag;
	const orgsConfig = globalConfig.orgs;
	const peers = [];


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
			if (tostop) {
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

	const CAs = [];
	const toggle = async ({container_name, port, Issuer}) => {

		if (toStop) {
			await containerDelete(container_name);
		} else {
			await runCA({container_name, port, network, imageTag, TLS, Issuer});
		}
	};

	for (const [ordererOrg, ordererOrgConfig] of Object.entries(globalConfig.orderer[type].orgs)) {
		const {portHost: port} = ordererOrgConfig.ca;
		const container_name = `ca.${ordererOrg}`;
		const Issuer = {CN: ordererOrg};
		await toggle({container_name, port, Issuer});
	}

	for (const [orgName, orgConfig] of Object.entries(peerOrgsConfig)) {
		const {ca: {portHost: port}} = orgConfig;
		const container_name = `ca.${orgName}`;
		const Issuer = {CN: orgName};
		await toggle({container_name, port, Issuer});
	}
};

exports.down = async () => {
	const toStop = true;
	try {
		await exports.runCAs(toStop);

		await exports.runPeers(undefined, toStop);
		await exports.runOrderers(undefined, toStop);
		await pruneLocalSystem();
		await chaincodeClean(true);
		await exports.volumesAction(toStop);

		fsExtra.emptyDirSync(MSPROOT);
		logger.info(`[done] clear MSPROOT ${MSPROOT}`);
		fsExtra.emptyDirSync(CONFIGTX);
		logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);

	} catch (err) {
		logger.error(err);
		process.exit(1);
	}
	logger.debug('[done] down');
};

exports.up = async () => {
	try {
		await fabricImagePull({fabricTag, caTag});

		await networkCreateIfNotExist({Name: network});

		await exports.volumesAction();
		await exports.runCAs();

		await require('./config/caCryptoGen').genAll();

		const PROFILE_BLOCK = globalConfig.orderer.genesis_block.profile;
		const configtxFile = path.resolve(__dirname, 'config', 'configtx.yaml');
		require('./config/configtx.js').gen({MSPROOT, PROFILE_BLOCK, configtxFile});


		const BLOCK_FILE = globalConfig.orderer.genesis_block.file;
		fsExtra.ensureDirSync(CONFIGTX);
		await genBlock(configtxFile, path.resolve(CONFIGTX, BLOCK_FILE), PROFILE_BLOCK);

		const channelsConfig = globalConfig.channels;
		for (const [channelName, channelConfig] of Object.entries(channelsConfig)) {
			const channelFile = path.resolve(CONFIGTX, channelConfig.file);
			await genChannel(configtxFile, channelFile, channelName, channelName);
		}


		await exports.runOrderers();

		await exports.runPeers();

	} catch (err) {
		logger.error(err);
		process.exit(1);
	}

	logger.debug('[done] up');

};
