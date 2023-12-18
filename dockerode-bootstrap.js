import fsExtra from 'fs-extra';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {ContainerManager, ContainerOptsBuilder} from '@davidkhala/docker/docker.js';
import {copy as dockerCP} from '@davidkhala/docker/dockerCmd.js';
import {homeResolve} from '@davidkhala/light/path.js';
import {importFrom, filedirname} from '@davidkhala/light/es6.mjs';
import * as peerUtil from './common/nodejs/peer.js';
import {FabricDockerode} from './common/nodejs/fabric-dockerode.js';
import {CryptoPath} from './common/nodejs/path.js';
import {container} from './common/nodejs/ca.js';

import * as caCrypoGenUtil from './config/caCryptoGen.js';

filedirname(import.meta);

const globalConfig = importFrom(import.meta, './config/orgs.json');

const MSPROOTPath = homeResolve(globalConfig.docker.volumes.MSPROOT);
const {docker: {fabricTag, caTag, network}, TLS} = globalConfig;
const logger = consoleLogger('dockerode-bootstrap');
const dockerManager = new ContainerManager(undefined, logger);
const dockernode = new FabricDockerode(dockerManager, ContainerOptsBuilder)
const {FABRIC_CA_HOME} = container;
export const runOrderers = async (toStop) => {
	const {orderer: {type}} = globalConfig;
	const CONFIGTXVolume = 'CONFIGTX';
	const MSPROOTVolume = 'MSPROOT';
	const imageTag = fabricTag;
	const {MSPROOT} = peerUtil.container;
	const nodeType = 'orderer';

	const toggle = async ({orderer, domain, port, mspid, portAdmin, loggingLevel}, ordererType, stateVolume, operations, metrics) => {
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
			await dockernode.runOrderer({
				container_name, imageTag, port, network, CONFIGTXVolume,
				msp: {
					id: mspid,
					configPath,
					volumeName: MSPROOTVolume
				},
				ordererType, loggingLevel,
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
			const {portHost, operations, metrics, portAdmin, loggingLevel} = ordererConfig;
			await toggle({
				orderer, domain, loggingLevel,
				port: portHost, mspid, portAdmin
			}, type, stateVolume, operations, metrics);
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
			const {container_name, port, couchDB, operations, loggingLevel, chaincodeOpts} = peerConfig;
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
				await dockernode.runCouchDB({container_name, port, network});
			}
			await dockernode.runPeer({
				container_name, port, imageTag, network, loggingLevel,
				peerHostName, tls,
				chaincodeOpts,
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
			await dockernode.runCA({container_name, port, network, imageTag, TLS});
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

describe('down', function () {
	this.timeout(0);
	const toStop = true;

	it('stop CAs', async () => {

		await runCAs(toStop);
	});

	it('stop peers', async () => {

		await runPeers(toStop);
	});

	it('stop orderers', async () => {
		await runOrderers(toStop);
	});
	it('prune docker in system', async () => {
		await dockerManager.prune.system();
	});
	it('clear chaincode legacy', async () => {
		await dockernode.chaincodeClear();
		await dockernode.chaincodeImageClear();
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


describe('up', function () {
	this.timeout(0);
	it('pull container image', async () => {
		await dockernode.fabricImagePull({fabricTag, caTag});
	});
	it('create docker network', async () => {
		await dockerManager.networkCreateIfNotExist(network);
	});
	it('setup docker volume', async () => {
		await volumesAction();
	});
	it('run CAs', async () => {
		await runCAs();
	});
	it('cryptogen', async () => {

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
			dockerCP(container_name, `${FABRIC_CA_HOME}/IssuerPublicKey`, IssuerPublicKey);
			dockerCP(container_name, `${FABRIC_CA_HOME}/IssuerRevocationPublicKey`, IssuerRevocationPublicKey);
		}
	});
	it('run Orderers', async () => {
		await runOrderers();
	});
	it('run peers', async () => {
		await runPeers();
	});

	after(function () {
		if (this.currentTest.state === 'passed') {
			logger.debug('[DONE] up');
		}
	});

});
