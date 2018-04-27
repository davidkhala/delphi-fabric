const globalConfig = require('./orgs.json');
const fs = require('fs');
const path = require('path');
const CURRENT = __dirname;
const yaml = require('js-yaml');
const helper = require('../app/helper');
const logger = require('../app/util/logger').new('compose-gen');
const peerUtil = require('../app/util/peer');
const caUtil = require('../app/util/ca');
const ordererUtil = require('../app/util/orderer');
const container =
	{
		dir: {
			CONFIGTX: '/etc/hyperledger/configtx',
			MSPROOT: '/etc/hyperledger/crypto-config',
			CA_HOME: '/etc/hyperledger/fabric-ca-server'
		}
	};
const dockerSock = '/host/var/run/docker.sock';

const {swarmServiceName} = require('../common/docker/nodejs/dockerode-util');
const addOrdererService = (services, {BLOCK_FILE, mspId, ordererEachConfig, MSPROOTVolume, CONFIGTXVolume}, {
	ordererName, domain, IMAGE_TAG,
	kafkaServices, swarmType = 'local',
	CONFIGTX = '/etc/hyperledger/configtx',
	MSPROOT = '/etc/hyperledger/crypto-config',
}) => {

	const {TLS} = globalConfig;
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
					`/run/docker.sock:${dockerSock}`,
					`${MSPROOTVolume}:${container.dir.MSPROOT}`]
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
		module.exports.addKafka(services,volumeName,{IMAGE_TAG,type,IMAGE_TAG_3rdParty});
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

exports.genCAs = ({
	arch = 'x86_64',
	COMPOSE_FILE = path.resolve(CURRENT, 'docker-ca-compose.yaml'),
	type:swarmType
}) => {
	logger.debug({arch, COMPOSE_FILE});

	const {docker: {fabricTag, network}, orderer: {type}} = globalConfig;

	const IMAGE_TAG = `${arch}-${fabricTag}`;

	const IMAGE_TAG_3rdParty = `${arch}-${globalConfig.docker.thirdPartyTag}`;
	const peerOrgsConfig = globalConfig.orgs;


	if (fs.existsSync(COMPOSE_FILE)) {
		fs.unlinkSync(COMPOSE_FILE);
	}

	const services = {};
	if (type === 'kafka') {
		for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrg];
			const caConfig = ordererOrgConfig.ca;
			module.exports.addCA(services, {caConfig}, {domain: ordererOrg, IMAGE_TAG});
		}
		module.exports.addKafka(services,{
			CONFIGTX:'CONFIGTX_local',
			MSPROOT :'MSPROOT_local'
		},{type:swarmType,IMAGE_TAG_3rdParty});
	} else {
		const {ca, container_name} = globalConfig.orderer.solo;
		module.exports.addCA(services, {caConfig: ca}, {domain: container_name, IMAGE_TAG});
	}

	for (const orgName in peerOrgsConfig) {
		const orgConfig = peerOrgsConfig[orgName];
		const caConfig = orgConfig.ca;

		module.exports.addCA(services, {caConfig}, {domain:orgName, IMAGE_TAG});
	}

	fs.writeFileSync(COMPOSE_FILE, yaml.safeDump({
		//only version 3 support network setting
		version: '3', //ERROR: Version in "/home/david/Documents/delphi-fabric/config/docker-compose.yaml" is invalid - it should be a string.
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
/**
 * config less ca server
 * @param services
 * @param caConfig
 * @param domain
 * @param TLS
 * @param IMAGE_TAG
 */
exports.addCA = (services, {caConfig}, { domain, IMAGE_TAG}) => {
	const {TLS} = globalConfig;
	let caContainerName;

	if (TLS) {
		caContainerName = `tlsca.${domain}`;
	} else {
		caContainerName = `ca.${domain}`;
	}
	const caService = {
		image: `hyperledger/fabric-ca:${IMAGE_TAG}`,
		command: 'fabric-ca-server start -d -b Admin:passwd',
		ports: [`${caConfig.portHost}:7054`],
		environment: caUtil.envBuilder(),
		container_name: caContainerName
	};
	let caServiceName = caContainerName;
	caService.networks = {
		default: {
			aliases: [caContainerName]
		}
	};
	caServiceName = swarmServiceName(caServiceName);

	services[caServiceName] = caService;
};
exports.addKafka = (services,volumeName,{type,IMAGE_TAG_3rdParty}) => {
	const kafkaConfigs = globalConfig.orderer.kafka.kafkas;
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;


	let KAFKA_ZOOKEEPER_CONNECT = 'KAFKA_ZOOKEEPER_CONNECT=';
	for (const zookeeper in zkConfigs) {
		KAFKA_ZOOKEEPER_CONNECT += `${zookeeper}:2181,`;
	}
	KAFKA_ZOOKEEPER_CONNECT = KAFKA_ZOOKEEPER_CONNECT.substring(0, KAFKA_ZOOKEEPER_CONNECT.length - 1);
	for (const zookeeper in zkConfigs) {
		const zkConfig = zkConfigs[zookeeper];
		let ZOO_SERVERS = 'ZOO_SERVERS=';
		services[zookeeper] = {
			image: `hyperledger/fabric-zookeeper:${IMAGE_TAG_3rdParty}`,
			ports: [2181, 2888, 3888],
			environment: [`ZOO_MY_ID=${zkConfig.MY_ID}`],
			networks: {
				default: {
					aliases:
						[zookeeper]
				}
			}

		};
		if (type === 'local') {
			services[zookeeper].container_name = zookeeper;
		}
		for (const zookeeper in zkConfigs) {
			const zkConfig2 = zkConfigs[zookeeper];
			if (type === 'swarm' && zkConfig === zkConfig2) {
				ZOO_SERVERS += `server.${zkConfig2.MY_ID}=0.0.0.0:2888:3888 `;
			} else {
				ZOO_SERVERS += `server.${zkConfig2.MY_ID}=${zookeeper}:2888:3888 `;
			}
		}
		services[zookeeper].environment.push(ZOO_SERVERS);
	}
	for (const kafka in kafkaConfigs) {
		const kafkaConfig = kafkaConfigs[kafka];
		services[kafka] = {
			image: `hyperledger/fabric-kafka:${IMAGE_TAG_3rdParty}`,

			environment: [
				`KAFKA_BROKER_ID=${kafkaConfig.BROKER_ID}`,
				KAFKA_ZOOKEEPER_CONNECT,
				'KAFKA_LOG_RETENTION_MS=-1',
				'KAFKA_MESSAGE_MAX_BYTES=103809024',//NOTE cannot be in format of 10 MB
				'KAFKA_REPLICA_FETCH_MAX_BYTES=103809024',//NOTE cannot be in format of 10 MB
				'KAFKA_UNCLEAN_LEADER_ELECTION_ENABLE=false',
				`KAFKA_DEFAULT_REPLICATION_FACTOR=${globalConfig.orderer.kafka.N}`,
				`KAFKA_MIN_INSYNC_REPLICAS=${globalConfig.orderer.kafka.M}`
			],
			ports: [9092],
			depends_on: Object.keys(zkConfigs),

			networks: {
				default: {
					aliases:
						[kafka]
				}
			},
		};
		if (type === 'local') {
			services[kafka].container_name = kafka;
		}
	}
};