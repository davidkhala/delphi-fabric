const globalConfig = require('./config/orgs.json');
const path = require('path');
const logger = require('khala-logger/log4js').consoleLogger('dockerode-bootstrap');
const peerUtil = require('./common/nodejs/peer');
const {runCouchDB, runCA, runPeer, runOrderer, fabricImagePull, chaincodeClear, chaincodeImageClear} = require('./common/nodejs/fabric-dockerode');
const {CryptoPath} = require('./common/nodejs/path');
const {container: {FABRIC_CA_HOME}} = require('./common/nodejs/ca');
const configConfigtx = require('./config/configtx.js');
const caCrypoGenUtil = require('./config/caCryptoGen');
const DockerManager = require('khala-dockerode/docker');
const {copy: dockerCP} = require('khala-dockerode/dockerCmd');
const fsExtra = require('fs-extra');
const {homeResolve} = require('khala-light-util');
const MSPROOTPath = homeResolve(globalConfig.docker.volumes.MSPROOT);
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX);
const {docker: {fabricTag, caTag, network}, TLS} = globalConfig;

const BinManager = require('./common/nodejs/binManager');
const dockerManager = new DockerManager();
exports.runOrderers = async (toStop) => {
	const {orderer: {type, raftPort, genesis_block: {file: BLOCK_FILE}}} = globalConfig;
	const CONFIGTXVolume = 'CONFIGTX';
	const MSPROOTVolume = 'MSPROOT';
	const imageTag = fabricTag;
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
			await dockerManager.containerDelete(container_name);
		} else {
			const tls = TLS ? cryptoPath.TLSFile(nodeType) : undefined;
			const raft_tls = cryptoPath.TLSFile(nodeType);
			raft_tls.port = raftPort;
			await runOrderer({
				container_name, imageTag, port, network,
				BLOCK_FILE, CONFIGTXVolume,
				msp: {
					id: mspid,
					configPath,
					volumeName: MSPROOTVolume
				},
				ordererType,
				tls, stateVolume, raft_tls,
			}, operations, metrics);
		}
	};
	const ordererOrgs = globalConfig.orderer.organizations;
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
			await dockerManager.volumeRemove(Name);
			continue;
		}
		await dockerManager.volumeCreateIfNotExist({Name, path: homeResolve(globalConfig.docker.volumes[Name])});
	}
};
exports.runPeers = async (toStop) => {
	const imageTag = fabricTag;
	const orgsConfig = globalConfig.organizations;


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
					await dockerManager.containerDelete(couchDB.container_name);
				}
				await dockerManager.containerDelete(container_name);
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
				await runCouchDB({container_name, port, network});
			}
			await runPeer({
				container_name, port, imageTag, network,
				peerHostName, tls,
				msp: {
					id: mspid,
					volumeName: 'MSPROOT',
					configPath
				}, couchDB, stateVolume
			}, operations);

		}

	}
};

exports.runCAs = async (toStop) => {
	const {organizations: peerOrgsConfig} = globalConfig;

	const imageTag = caTag;

	const toggle = async ({container_name, port, Issuer}) => {

		if (toStop) {
			await dockerManager.containerDelete(container_name);
		} else {
			await runCA({container_name, port, network, imageTag, TLS, issuer: Issuer});
		}
	};

	for (const [ordererOrg, ordererOrgConfig] of Object.entries(globalConfig.orderer.organizations)) {
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

	await exports.runCAs(toStop);

	await exports.runPeers(toStop);
	await exports.runOrderers(toStop);
	await dockerManager.prune.system();
	await chaincodeClear();
	await chaincodeImageClear();
	await exports.volumesAction(toStop);

	fsExtra.emptyDirSync(MSPROOTPath);
	logger.info(`[done] clear MSPROOT ${MSPROOTPath}`);
	fsExtra.emptyDirSync(CONFIGTX);
	logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);
};

exports.up = async () => {
	await fabricImagePull({fabricTag, caTag});

	const binManager = new BinManager();

	await dockerManager.networkCreateIfNotExist({Name: network});

	await exports.volumesAction();
	await exports.runCAs();

	await caCrypoGenUtil.genAll();

	// TODO idemix
	{
		// TODO orderer org idemix
		for (const orgName of Object.keys(globalConfig.organizations)) {
			const container_name = `ca.${orgName}`;
			const cryptoPath = new CryptoPath(MSPROOTPath, {
				peer: {
					org: orgName
				}
			});

			const {msp: {IssuerPublicKey, IssuerRevocationPublicKey}} = cryptoPath.OrgFile('peer');
			await dockerCP(container_name, `${FABRIC_CA_HOME}/IssuerPublicKey`, IssuerPublicKey);
			await dockerCP(container_name, `${FABRIC_CA_HOME}/IssuerRevocationPublicKey`, IssuerRevocationPublicKey);
		}
	}

	const PROFILE_BLOCK = globalConfig.orderer.genesis_block.profile;
	const configtxFile = path.resolve(__dirname, 'config', 'configtx.yaml');
	configConfigtx.gen({MSPROOT: MSPROOTPath, PROFILE_BLOCK, configtxFile});


	const BLOCK_FILE = globalConfig.orderer.genesis_block.file;
	fsExtra.ensureDirSync(CONFIGTX);
	await binManager.configtxgen(PROFILE_BLOCK, configtxFile).genBlock(path.resolve(CONFIGTX, BLOCK_FILE));

	await exports.runOrderers();
	await exports.runPeers();
};
