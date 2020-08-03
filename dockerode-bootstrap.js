const globalConfig = require('./config/orgs.json');
const path = require('path');
const logger = require('khala-logger/log4js').consoleLogger('dockerode-bootstrap');
const peerUtil = require('./common/nodejs/peer');
const {
	runCouchDB,
	runCA,
	runPeer, runOrderer,
	chaincodeClear, chaincodeImageClear
} = require('./common/nodejs/fabric-dockerode');
const {CryptoPath} = require('./common/nodejs/path');
const Configtx = require('./nodePkg/configtx.js');
const CaCryptoGenUtil = require('./nodePkg/caCryptoGen');
const caCryptoGenUtil = new CaCryptoGenUtil(globalConfig);
const DockerManager = require('khala-dockerode/docker');
const docker = new DockerManager(undefined, logger);
const {homeResolve, fsExtra} = require('khala-nodeutils/helper');
const MSPROOT = homeResolve(globalConfig.docker.volumes.MSPROOT);
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX);
const {docker: {fabricTag, caTag, network}, TLS} = globalConfig;

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
			await docker.containerDelete(container_name);
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
			await docker.volumeRemove(Name);
			continue;
		}
		await docker.volumeCreateIfNotExist({Name, path: homeResolve(globalConfig.docker.volumes[Name])});
	}
};
exports.runPeers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, toStop) => {
	const imageTag = fabricTag;
	const orgsConfig = globalConfig.organizations;


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
					await docker.containerDelete(couchDB.container_name);
				}
				await docker.containerDelete(container_name);
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
				const {container_name, port, user, password} = couchDB;
				await runCouchDB({container_name, port, network, user, password});
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
	const {organizations: peerOrgsConfig} = globalConfig;

	const imageTag = caTag;

	const toggle = async ({container_name, port, issuer}) => {

		if (toStop) {
			await docker.containerDelete(container_name);
		} else {
			await runCA({container_name, port, network, imageTag, TLS, issuer});
		}
	};
	for (const [ordererOrg, ordererOrgConfig] of Object.entries(globalConfig.orderer.organizations)) {
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
	const {organizations: peerOrgsConfig} = globalConfig;

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
			await docker.containerDelete(container_name);
		} else {
			const {enrollmentID, enrollmentSecret} = await caCryptoGenUtil.genIntermediate(org, parentPort, nodeType);
			const intermediate = {host: parentHost, port: parentPort, enrollmentID, enrollmentSecret};
			await runCA({container_name, port, network, imageTag: caTag, TLS, issuer}, intermediate);
		}
	};

	for (const [ordererOrg, ordererOrgConfig] of Object.entries(globalConfig.orderer.organizations)) {
		await toggle(ordererOrg, ordererOrgConfig, 'orderer');
	}

	for (const [orgName, orgConfig] of Object.entries(peerOrgsConfig)) {
		await toggle(orgName, orgConfig, 'peer');
	}
};


exports.down = async () => {

	const toStop = true;
	await exports.runCAs(toStop);

	await exports.runPeers(undefined, toStop);
	await exports.runOrderers(undefined, toStop);

	await docker.prune.system();
	await chaincodeClear();
	await chaincodeImageClear();
	await exports.volumesAction(toStop);

	fsExtra.emptyDirSync(MSPROOT);
	logger.info(`[done] clear MSPROOT ${MSPROOT}`);
	fsExtra.emptyDirSync(CONFIGTX);
	logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);
};

exports.up = async () => {

	const binManager = new BinManager();

	await docker.networkCreateIfNotExist({Name: network});

	await exports.volumesAction();
	await exports.runCAs();

	await caCryptoGenUtil.genAll();

	const PROFILE_BLOCK = globalConfig.orderer.genesis_block.profile;
	const configtxFile = path.resolve(__dirname, 'config', 'configtx.yaml');
	const configtx = new Configtx(globalConfig, configtxFile);

	configtx.gen(PROFILE_BLOCK);


	const BLOCK_FILE = globalConfig.orderer.genesis_block.file;
	fsExtra.ensureDirSync(CONFIGTX);
	await binManager.configtxgen(PROFILE_BLOCK, configtxFile).genBlock(path.resolve(CONFIGTX, BLOCK_FILE));

	await exports.runOrderers();
	await exports.runPeers();
};
