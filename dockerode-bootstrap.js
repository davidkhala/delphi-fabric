import globalConfig from './config/orgs.json';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import peerUtil from './common/nodejs/peer';
import {runCouchDB, runCA, runPeer, runOrderer, fabricImagePull, chaincodeClear, chaincodeImageClear} from './common/nodejs/fabric-dockerode.js';
import {CryptoPath} from './common/nodejs/path.js';
import {container} from './common/nodejs/ca';
import configConfigtx from './config/configtx.js';
import caCrypoGenUtil from './config/caCryptoGen.js';
import DockerManager from '@davidkhala/dockerode/docker.js';
import {copy as dockerCP} from '@davidkhala/dockerode/dockerCmd';
import fsExtra from 'fs-extra';
import path from 'path';
import {homeResolve} from '@davidkhala/light/index.js';
const MSPROOTPath = homeResolve(globalConfig.docker.volumes.MSPROOT);
const {docker: {fabricTag, caTag, network}, TLS} = globalConfig;
const logger = consoleLogger('dockerode-bootstrap');
const dockerManager = new DockerManager();
const {FABRIC_CA_HOME} = container;
export const runOrderers = async (toStop) => {
	const {orderer: {type, raftPort}} = globalConfig;
	const CONFIGTXVolume = 'CONFIGTX';
	const MSPROOTVolume = 'MSPROOT';
	const imageTag = fabricTag;
	const {MSPROOT} = peerUtil.container;
	const nodeType = 'orderer';

	const toggle = async ({orderer, domain, port, mspid, portAdmin}, ordererType, stateVolume, operations, metrics) => {
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
				container_name, imageTag, port, network, CONFIGTXVolume,
				msp: {
					id: mspid,
					configPath,
					volumeName: MSPROOTVolume
				},
				ordererType,
				tls, stateVolume, raft_tls,
				portAdmin,
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
			const {portHost, operations, metrics, portAdmin} = ordererConfig;
			await toggle({orderer, domain, port: portHost, mspid, portAdmin}, type, stateVolume, operations, metrics);
		}
	}
};

export const volumesAction = async (toStop) => {
	for (const Name in globalConfig.docker.volumes) {
		if (toStop) {
			await dockerManager.volumeRemove(Name);
			continue;
		}
		await dockerManager.volumeCreateIfNotExist({Name, path: homeResolve(globalConfig.docker.volumes[Name])});
	}
};
export const runPeers = async (toStop) => {
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

export const runCAs = async (toStop) => {
	const {organizations: peerOrgsConfig} = globalConfig;

	const imageTag = caTag;

	const toggle = async ({container_name, port}) => {

		if (toStop) {
			await dockerManager.containerDelete(container_name);
		} else {
			await runCA({container_name, port, network, imageTag, TLS});
		}
	};

	for (const [ordererOrg, ordererOrgConfig] of Object.entries(globalConfig.orderer.organizations)) {
		const {portHost: port} = ordererOrgConfig.ca;
		const container_name = `ca.${ordererOrg}`;
		await toggle({container_name, port});
	}

	for (const [orgName, orgConfig] of Object.entries(peerOrgsConfig)) {
		const {ca: {portHost: port}} = orgConfig;
		const container_name = `ca.${orgName}`;
		await toggle({container_name, port});
	}
};

describe('down', () => {
	const toStop = true;

	it('stop CAs', async function () {
		this.timeout(0);
		await runCAs(toStop);
	});

	it('stop peers', async function () {
		this.timeout(0);
		await runPeers(toStop);
	});

	it('stop orderers', async function () {
		this.timeout(0);
		await runOrderers(toStop);
	});
	it('prune docker in system', async () => {
		await dockerManager.prune.system();
	});
	it('clear chaincode legacy', async () => {
		await chaincodeClear();
		await chaincodeImageClear();
	});
	it('clear volumes and local artifacts', async () => {
		await volumesAction(toStop);
		fsExtra.emptyDirSync(MSPROOTPath);
		logger.info(`[done] clear MSPROOT ${MSPROOTPath}`);
		for (const [channelName, {file}] of Object.entries(globalConfig.channels)) {
			fsExtra.removeSync(file);
			logger.info(`[done] clear ${channelName}.block ${file}`);
		}
	});
	after(function () {
		if (this.currentTest.state === 'passed') {
			logger.debug('[DONE] down');
		}
	});
});


describe('up', () => {
	it('pull container image', async function () {
		this.timeout(0);
		await fabricImagePull({fabricTag, caTag});
	});
	it('create docker network', async () => {
		await dockerManager.networkCreateIfNotExist({Name: network});
	});
	it('setup docker volume', async () => {
		await volumesAction();
	});
	it('run CAs', async () => {
		await runCAs();
	});
	it('cryptogen', async function () {
		this.timeout(0);
		await caCrypoGenUtil.genAll();
	});
	// TODO idemix
	it.skip('idemix', async () => {
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
	});
	it('run Orderers', async () => {
		await runOrderers();
	});
	it('run peers', async () => {
		await runPeers();
	});
	it('Configtxgen', async () => {
		const configtxFile = path.resolve(__dirname, 'config', 'configtx.yaml');
		configConfigtx.gen({MSPROOT: MSPROOTPath, configtxFile});
	});
	after(function () {
		if (this.currentTest.state === 'passed') {
			logger.debug('[DONE] up');
		}
	});

});
