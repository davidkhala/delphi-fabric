const path = require('path');
const logger = require('khala-logger/log4js').consoleLogger('dockerode-bootstrap');
const peerUtil = require('khala-fabric-sdk-node/peer');
const {
	runCouchDB,
	runCA,
	runPeer, runOrderer,
	chaincodeClear, chaincodeImageClear
} = require('khala-fabric-sdk-node/fabric-dockerode');
const {CryptoPath} = require('khala-fabric-sdk-node/path');
const Configtx = require('./configtx.js');
const CaCryptoGenUtil = require('./caCryptoGen');

const DockerManager = require('khala-dockerode/docker');
const docker = new DockerManager(undefined, logger);
const {homeResolve, fsExtra} = require('khala-nodeutils/helper');

const BinManager = require('khala-fabric-sdk-node/binManager');

class DockerodeBootstrap {
	constructor(globalConfig, configtxYaml) {
		this.globalConfig = globalConfig;
		this.caCryptoGenUtil = new CaCryptoGenUtil(globalConfig);
		this.context = this.caCryptoGenUtil.context;
		this.configtxYaml = configtxYaml;
	}

	async runOrderers(toStop, type = this.globalConfig.orderer.type) {
		const {orderer: {genesis_block: {file: BLOCK_FILE}}} = this.globalConfig;
		const {docker: {fabricTag: imageTag, network}, TLS} = this.globalConfig;
		const CONFIGTXVolume = 'CONFIGTX';
		const MSPROOTVolume = 'MSPROOT';
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
		const ordererOrgs = this.globalConfig.orderer.organizations;
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
	}

	async volumesAction(toStop) {
		for (const Name in this.globalConfig.docker.volumes) {
			if (toStop) {
				await docker.volumeRemove(Name);
			} else {
				await docker.volumeCreateIfNotExist({Name, path: homeResolve(this.globalConfig.docker.volumes[Name])});
			}
		}
	}

	async runPeers(toStop) {
		const {docker: {fabricTag: imageTag, network}, TLS} = this.globalConfig;
		const orgsConfig = this.globalConfig.organizations;

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
						volumeName: 'MSPROOT',
						configPath
					}, couchDB, stateVolume
				}, operations, metrics);

			}

		}
	}

	async runCAs(toStop) {

		const {docker: {caTag: imageTag, network}, TLS} = this.globalConfig;

		const toggle = async ({container_name, port, issuer}) => {

			if (toStop) {
				await docker.containerDelete(container_name);
			} else {
				await runCA({container_name, port, network, imageTag, TLS, issuer});
			}
		};
		for (const [ordererOrg, ordererOrgConfig] of Object.entries(this.globalConfig.orderer.organizations)) {
			const {portHost: port} = ordererOrgConfig.ca;
			const container_name = `ca.${ordererOrg}`;
			const issuer = {CN: ordererOrg};
			await toggle({container_name, port, issuer});
		}

		for (const [orgName, orgConfig] of Object.entries(this.globalConfig.organizations)) {
			const {ca: {portHost: port}} = orgConfig;
			const container_name = `ca.${orgName}`;
			const issuer = {CN: orgName};
			await toggle({container_name, port, issuer});
		}
	}

	async runIntermediateCAs(toStop) {
		const {docker: {caTag: imageTag, network}, TLS} = this.globalConfig;
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
				const {enrollmentID, enrollmentSecret} = await this.caCryptoGenUtil.genIntermediate(org, parentPort, nodeType);
				const intermediate = {host: parentHost, port: parentPort, enrollmentID, enrollmentSecret};
				await runCA({container_name, port, network, imageTag, TLS, issuer}, intermediate);
			}
		};

		for (const [ordererOrg, ordererOrgConfig] of Object.entries(this.globalConfig.orderer.organizations)) {
			await toggle(ordererOrg, ordererOrgConfig, 'orderer');
		}

		for (const [orgName, orgConfig] of Object.entries(this.globalConfig.organizations)) {
			await toggle(orgName, orgConfig, 'peer');
		}
	}

	async down() {

		const CONFIGTX = this.context.CONFIGTX_DIR;
		const toStop = true;
		await this.runCAs(toStop);

		await this.runPeers(toStop);
		await this.runOrderers(toStop);

		await docker.prune.system();
		await chaincodeClear();
		await chaincodeImageClear();
		await this.volumesAction(toStop);

		fsExtra.emptyDirSync(this.context.CRYPTO_CONFIG_DIR);
		logger.info(`[done] clear MSPROOT ${this.context.CRYPTO_CONFIG_DIR}`);
		fsExtra.emptyDirSync(CONFIGTX);
		logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);
	}

	async up() {
		const CONFIGTX = this.context.CONFIGTX_DIR;
		const binManager = new BinManager();

		const network = this.globalConfig.docker.network;
		await docker.networkCreateIfNotExist({Name: network});

		await this.volumesAction();
		await this.runCAs();

		await this.caCryptoGenUtil.genAll();

		const PROFILE_BLOCK = this.globalConfig.orderer.genesis_block.profile;
		const configtx = new Configtx(this.globalConfig, this.configtxYaml);

		configtx.gen(PROFILE_BLOCK);


		const BLOCK_FILE = this.globalConfig.orderer.genesis_block.file;
		fsExtra.ensureDirSync(CONFIGTX);
		await binManager.configtxgen(PROFILE_BLOCK, this.configtxYaml).genBlock(path.resolve(CONFIGTX, BLOCK_FILE));

		await this.runOrderers();
		await this.runPeers();
	}

}

module.exports = DockerodeBootstrap;



