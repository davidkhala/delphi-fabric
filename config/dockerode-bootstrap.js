const globalConfig = require('./orgs.json');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const CURRENT = __dirname;
const yaml = require('js-yaml');
const logger = require('../common/nodejs/logger').new('dockerode-bootstrap');
const peerUtil = require('../common/nodejs/peer');
const ordererUtil = require('../common/nodejs/orderer');
const dockerodeUtil = require('../common/nodejs/fabric-dockerode');
const channelUtil = require('../common/nodejs/channel');

const arch = 'x86_64';
const {swarmServiceName, containerDelete, networkRemove,volumeCreateIfNotExist,
	volumeRemove, prune: {system: pruneSystem}} = require('../common/docker/nodejs/dockerode-util');
const {docker: {fabricTag, network, thirdPartyTag}, TLS} = globalConfig;
const addOrdererService = (services, {BLOCK_FILE, mspId, ordererEachConfig, MSPROOTVolume, CONFIGTXVolume}, {
	ordererName, domain, IMAGE_TAG,
	kafkaServices, swarmType = 'local',
	CONFIGTX = '/etc/hyperledger/configtx',
	MSPROOT = '/etc/hyperledger/crypto-config',
}) => {

	let ordererServiceName = ordererName;
	const ORDERER_STRUCTURE = `ordererOrganizations/${domain}/orderers/${ordererServiceName}.${domain}`;

	const environment = ordererUtil.envBuilder({
		BLOCK_FILE,
		msp: {
			configPath: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'msp'),
			id: mspId
		},
		kafka: kafkaServices,
		tls: TLS ? {
			serverKey: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'server.key'),
			serverCrt: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'server.crt'),
			caCrt: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'ca.crt')
		} : undefined
	});
	const ordererService = {
		image: `hyperledger/fabric-orderer:${IMAGE_TAG}`,
		command: 'orderer',
		ports: [`${ordererEachConfig.portHost}:7050`],
		volumes: [
			`${CONFIGTXVolume}:${CONFIGTX}`,
			`${MSPROOTVolume}:${MSPROOT}`],
		environment,
		networks: {
			default: {
				aliases: [ordererServiceName]
			}
		}
	};
	if (swarmType === 'swarm') {
		ordererServiceName = swarmServiceName(ordererServiceName);
		ordererService.deploy = {
			placement: {
				constraints: ordererEachConfig.swarm.constraints
			}
		};

	} else {
		ordererService.container_name = ordererServiceName;
	}
	if (Array.isArray(kafkaServices)) {
		ordererService.depends_on = kafkaServices;
	}

	services[ordererServiceName] = ordererService;
};

exports.runOrderers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, toStop) => {
	const {orderer: {type, genesis_block: {file: BLOCK_FILE}}} = globalConfig;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	const imageTag = `${arch}-${fabricTag}`;
	const {MSPROOT} = peerUtil.container;
	if (type === 'kafka') {
		const ordererOrgs = globalConfig.orderer.kafka.orgs;
		for (const domain in ordererOrgs) {
			const ordererOrgConfig = ordererOrgs[domain];
			const {MSP: {id}} = ordererOrgConfig;
			for (const orderer in ordererOrgConfig.orderers) {
				const container_name = `${orderer}.${domain}`;
				if (toStop) {
					await containerDelete(container_name);
					continue;
				}
				const ordererConfig = ordererOrgConfig.orderers[orderer];
				const port = ordererConfig.portHost;

				const ORDERER_STRUCTURE = `ordererOrganizations/${domain}/orderers/${orderer}.${domain}`;
				await dockerodeUtil.runOrderer({
					container_name, imageTag, port, network,
					BLOCK_FILE, CONFIGTXVolume,
					msp: {
						id,
						configPath: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'msp'),
						volumeName: MSPROOTVolume
					},
					kafkas: true,
					tls: TLS ? {
						serverKey: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'server.key'),
						serverCrt: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'server.crt'),
						caCrt: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'ca.crt')
					} : undefined
				});
			}
		}
	} else {
		const ordererConfig = globalConfig.orderer.solo;
		const {orgName: domain, MSP: {id}, portHost: port} = ordererConfig;

		const orderer = ordererConfig.container_name;
		const ORDERER_STRUCTURE = `ordererOrganizations/${domain}/orderers/${orderer}.${domain}`;

		const container_name = `${orderer}.${domain}`;
		if (toStop) {
			await containerDelete(container_name);
		} else {
			await dockerodeUtil.runOrderer({
				container_name, imageTag, port, network,
				BLOCK_FILE, CONFIGTXVolume,
				msp: {
					id,
					configPath: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'msp'),
					volumeName: MSPROOTVolume
				},
				tls: TLS ? {
					serverKey: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'server.key'),
					serverCrt: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'server.crt'),
					caCrt: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'ca.crt')
				} : undefined
			});
		}
	}
};

exports.gen = ({
				   MSPROOT,
				   arch = 'x86_64',
				   COMPOSE_FILE = path.resolve(CURRENT, 'docker-compose.yaml'),
				   type = 'local', volumeName
			   }) => {

	logger.debug({MSPROOT, arch, COMPOSE_FILE, type, volumeName});

	const companyConfig = globalConfig;
	const {TLS, docker: {fabricTag, thirdPartyTag, volumes: volumeConfig, network}} = companyConfig;
	const IMAGE_TAG = `${arch}-${fabricTag}`;

	const IMAGE_TAG_3rdParty = `${arch}-${thirdPartyTag}`;
	const orgsConfig = companyConfig.orgs;
	const ordererConfig = companyConfig.orderer;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	// const ordererContainerPort = ordererConfig.portMap[0].container

	if (fs.existsSync(COMPOSE_FILE)) {
		fs.unlinkSync(COMPOSE_FILE);
	}

	const services = {};


	for (const orgName in orgsConfig) {
		const orgConfig = orgsConfig[orgName];
		const orgDomain = `${orgName}`;
		const peersConfig = orgConfig.peers;

		for (const peerIndex in peersConfig) {
			const peerDomain = `peer${peerIndex}.${orgDomain}`;
			const peerConfig = peersConfig[peerIndex];

			const PEER_STRUCTURE = `peerOrganizations/${orgDomain}/peers/${peerDomain}`;


			const tls = TLS ? {
				serverKey: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'tls', 'server.key'),
				serverCrt: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'tls', 'server.crt'),
				caCrt: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'tls', 'ca.crt')
			} : undefined;
			const environment = peerUtil.envBuilder({
				network, msp: {
					configPath: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'msp'),
					id: orgConfig.MSP.id,
					peer_hostName_full: peerDomain
				}, tls
			});
			const ports = [];
			for (const portIndex in peerConfig.portMap) {
				const entry = peerConfig.portMap[portIndex];
				ports.push(`${entry.host}:${entry.container}`);
			}
			const peerService = {
				image: `hyperledger/fabric-peer:${IMAGE_TAG}`,
				command: 'peer node start',
				environment,
				ports,
				volumes: [
					`${peerUtil.host.dockerSock}:${peerUtil.container.dockerSock}`,
					`${MSPROOTVolume}:${peerUtil.container.MSPROOT}`]
			};
			if (companyConfig.orderer.type === 'kafka') {
				const depends_on = [];
				for (const ordererOrgName in companyConfig.orderer.kafka.orgs) {
					const ordererOrgConfig = companyConfig.orderer.kafka.orgs[ordererOrgName];
					for (const ordererName in ordererOrgConfig.orderers) {
						depends_on.push(ordererName);
					}
				}
				peerService.depends_on = depends_on;
			} else {
				peerService.depends_on = [companyConfig.orderer.solo.container_name];
			}

			let peerServiceName = peerDomain;

			if (type === 'swarm') {
				peerServiceName = swarmServiceName(peerServiceName);
				peerService.networks = {
					default: {
						aliases: [peerDomain]
					}
				};
				peerService.deploy = {
					placement: {
						constraints: peerConfig.swarm.constraints
					}
				};
			} else {
				peerService.container_name = peerConfig.container_name;
				peerService.networks = ['default'];
			}
			services[peerServiceName] = peerService;

		}

	}


	if (companyConfig.orderer.type === 'kafka') {
		const kafkaConfigs = globalConfig.orderer.kafka.kafkas;
		const BLOCK_FILE = globalConfig.orderer.genesis_block.file;
		const CONFIGTXVolume = volumeName.CONFIGTX;
		const MSPROOTVolume = volumeName.MSPROOT;
		for (const ordererOrgName in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrgName];
			const mspId = ordererOrgConfig.MSP.id;
			for (const ordererName in ordererOrgConfig.orderers) {
				const ordererEachConfig = ordererOrgConfig.orderers[ordererName];
				addOrdererService(services, {BLOCK_FILE, mspId, ordererEachConfig, CONFIGTXVolume, MSPROOTVolume}, {
					ordererName, domain: ordererOrgName, IMAGE_TAG,
					swarmType: type,
					kafkaServices: Object.keys(kafkaConfigs)
				});

			}
		}
		module.exports.addKafka(services, volumeName, {IMAGE_TAG, type, IMAGE_TAG_3rdParty});
	} else {
		const ordererEachConfig = companyConfig.orderer.solo;
		const BLOCK_FILE = companyConfig.orderer.genesis_block.file;
		const mspId = companyConfig.orderer.solo.MSP.id;
		addOrdererService(services, {BLOCK_FILE, mspId, ordererEachConfig, CONFIGTXVolume, MSPROOTVolume}, {
			ordererName: ordererEachConfig.container_name,
			domain: ordererEachConfig.orgName, IMAGE_TAG,
			swarmType: type,
		});
	}


	fs.writeFileSync(COMPOSE_FILE, yaml.safeDump({
		//only version 3 support network setting
		version: '3', //ERROR: Version in "/home/david/Documents/delphi-fabric/config/docker-compose.yaml" is invalid - it should be a string.
		volumes: {
			[MSPROOTVolume]: {
				external: true
			},
			[CONFIGTXVolume]: {
				external: true
			}
		},
		networks: {
			default: {
				external: {
					name: network
				}
			}
		},
		services

	}, {lineWidth: 180}));

};
exports.volumesAction = async (toStop) => {
	for (const Name in globalConfig.docker.volumes) {
		if (toStop) {
			await volumeRemove({Name});
			continue;
		}
		const path = globalConfig.docker.volumes[Name].dir;
		await volumeCreateIfNotExist({Name, path});
	}
};
exports.down = async () => {
	const {orderer: {type}} = globalConfig;

	const toStop = true;
	await module.exports.runCAs(toStop);
	await module.exports.runPeers(undefined, toStop);
	await module.exports.runOrderers(undefined, toStop);
	if (type === 'kafka') {
		await module.exports.runKafkas(toStop);
		await module.exports.runZookeepers(toStop);
	}
	await dockerodeUtil.chaincodeContainerClean();

	await networkRemove({Name: network});
	await module.exports.volumesAction(toStop);
	await pruneSystem();

	const nodeAppConfigJson=require('../app/config');
	fsExtra.removeSync(nodeAppConfigJson.stateDBCacheDir);
	logger.info(`[done] clear stateDBCacheDir ${nodeAppConfigJson.stateDBCacheDir}`);


	const MSPROOT = globalConfig.docker.volumes.MSPROOT.dir;
	const CONFIGTX = globalConfig.docker.volumes.CONFIGTX.dir;
	fsExtra.removeSync(MSPROOT);
	logger.info(`[done] clear MSPROOT ${MSPROOT}`);
	fsExtra.removeSync(CONFIGTX);
	logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);

};
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const runConfigtxGenShell = path.resolve(path.dirname(__dirname),'common','bin-manage','runConfigtxgen.sh');
exports.up = async () => {
	const {orderer: {type}} = globalConfig;
	await pruneSystem();
	await module.exports.volumesAction();
	await dockerodeUtil.networkCreateIfNotExist({Name: network});
	await module.exports.runCAs();
	if (type === 'kafka') {
		await module.exports.runZookeepers();
		await module.exports.runKafkas();
	}
	await require('./ca-crypto-gen').genAll();

	const MSPROOT = globalConfig.docker.volumes.MSPROOT.dir;
	const CONFIGTX = globalConfig.docker.volumes.CONFIGTX.dir;
	const PROFILE_BLOCK = globalConfig.orderer.genesis_block.profile;
	const configtxFile = path.resolve(__dirname, 'configtx.yaml');
	require('./configtx.js').gen({MSPROOT,PROFILE_BLOCK,configtxFile});



	const BLOCK_FILE=globalConfig.orderer.genesis_block.file;
	const config_dir = path.dirname(configtxFile);
	fsExtra.ensureDirSync(CONFIGTX);
	await exec(`${runConfigtxGenShell} block create ${path.resolve(CONFIGTX,BLOCK_FILE)} -p ${PROFILE_BLOCK} -i ${config_dir}`);

	const channelsConfig = globalConfig.channels;
	for(const channelName in channelsConfig){
		channelUtil.nameMatcher(channelName,true);
		const channelConfig = channelsConfig[channelName];
		const channelFile = path.resolve(CONFIGTX,channelConfig.file);
		await exec(`${runConfigtxGenShell} channel create ${channelFile} -p ${channelName} -i ${config_dir} -c ${channelName}`)
	}



	await module.exports.runOrderers();
	await module.exports.runPeers();
};

exports.runPeers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, tostop) => {
	const imageTag = `${arch}-${fabricTag}`;
	const orgsConfig = globalConfig.orgs;
	if(!tostop) await dockerodeUtil.imagePullCCENV(imageTag);
	for (const domain in orgsConfig) {
		const orgConfig = orgsConfig[domain];
		const peersConfig = orgConfig.peers;

		const {MSP: {id}} = orgConfig;
		for (const peerIndex in peersConfig) {
			const peerConfig = peersConfig[peerIndex];
			const {container_name, portMap} = peerConfig;

			if (tostop) {
				await containerDelete(container_name);
				continue;
			}
			const peerDomain = `peer${peerIndex}.${domain}`;
			const PEER_STRUCTURE = `peerOrganizations/${domain}/peers/${peerDomain}`;


			const tls = TLS ? {
				serverKey: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'tls', 'server.key'),
				serverCrt: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'tls', 'server.crt'),
				caCrt: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'tls', 'ca.crt')
			} : undefined;

			const port = portMap.find(portEntry => portEntry.container === 7051).host;
			const eventHubPort = portMap.find(portEntry => portEntry.container === 7053).host;
			await dockerodeUtil.runPeer({
				container_name, port, eventHubPort, imageTag, network,
				peer_hostName_full: peerDomain, tls,
				msp: {
					id,
					volumeName: volumeName.MSPROOT,
					configPath: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'msp')
				}
			});

		}

	}
};

exports.runCAs = async (toStop) => {
	const {orderer: {type}, orgs: peerOrgsConfig} = globalConfig;

	const imageTag = `${arch}-${fabricTag}`;

	if (type === 'kafka') {
		for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrg];
			const {portHost: port} = ordererOrgConfig.ca;
			let container_name;
			if (TLS) {
				container_name = `tlsca.${ordererOrg}`;
			} else {
				container_name = `ca.${ordererOrg}`;
			}
			if (toStop) {
				await containerDelete(container_name);
			} else {
				await dockerodeUtil.runCA({container_name, port, network, imageTag});
			}
		}
	} else {
		const {ca: {portHost: port}, orgName} = globalConfig.orderer.solo;
		let container_name;
		if (TLS) {
			container_name = `tlsca.${orgName}`;
		} else {
			container_name = `ca.${orgName}`;
		}
		if (toStop) {
			await containerDelete(container_name);
		} else {
			await dockerodeUtil.runCA({container_name, port, network, imageTag});
		}
	}

	for (const orgName in peerOrgsConfig) {
		const orgConfig = peerOrgsConfig[orgName];
		const {ca: {portHost: port}} = orgConfig;

		let container_name;

		if (TLS) {
			container_name = `tlsca.${orgName}`;
		} else {
			container_name = `ca.${orgName}`;
		}
		if (toStop) {
			await containerDelete(container_name);
		} else {
			await dockerodeUtil.runCA({container_name, port, network, imageTag});
		}
	}
};
exports.runZookeepers = async (toStop) => {
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const imageTag = `${arch}-${thirdPartyTag}`;
	const allIDs = Object.values(zkConfigs).map(config => config.MY_ID);
	for (const zookeeper in zkConfigs) {
		const zkConfig = zkConfigs[zookeeper];
		const {MY_ID} = zkConfig;
		if (toStop) {
			await containerDelete(zookeeper);
		} else {
			await dockerodeUtil.runZookeeper({
				container_name: zookeeper, MY_ID, imageTag, network
			}, allIDs);
		}
	}
};
exports.runKafkas = async (toStop) => {
	const kafkaConfigs = globalConfig.orderer.kafka.kafkas;
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const zookeepers = Object.keys(zkConfigs);
	const {N, M} = globalConfig.orderer.kafka;
	const imageTag = `${arch}-${thirdPartyTag}`;

	for (const kafka in kafkaConfigs) {
		const kafkaConfig = kafkaConfigs[kafka];
		const {BROKER_ID} = kafkaConfig;
		if (toStop) {
			await containerDelete(kafka);
		} else {
			await dockerodeUtil.runKafka({
				container_name: kafka, network, imageTag, BROKER_ID
			}, zookeepers, {N, M});
		}

	}
};
