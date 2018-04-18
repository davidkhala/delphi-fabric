const globalConfig = require('./orgs.json');
const fs = require('fs');
const path = require('path');
const CURRENT = __dirname;
const yaml = require('js-yaml');
const helper = require('../app/helper');
const logger = require('../app/util/logger').new('compose-gen');
const peerUtil = require('../app/util/peer');
const container =
	{
		dir: {
			CONFIGTX: '/etc/hyperledger/configtx',
			MSPROOT: '/etc/hyperledger/crypto-config',
			CA_HOME: '/etc/hyperledger/fabric-ca-server'
		}
	};
const dockerSock = '/host/var/run/docker.sock';

const swarmServiceName = (serviceName) => {
	return serviceName.replace(/\./g, '-');
};
const addOrdererService = (services, {BLOCK_FILE, mspId, ordererEachConfig, MSPROOTVolume, CONFIGTXVolume}, {
	ordererName, domain, IMAGE_TAG,
	ORDERER_GENERAL_TLS_ROOTCAS,
	kafkaServices, swarmType = 'local',
	CONFIGTX = '/etc/hyperledger/configtx',
	MSPROOT = '/etc/hyperledger/crypto-config',
}) => {

	const {TLS} = globalConfig;
	let ordererServiceName = ordererName;
	const ORDERER_STRUCTURE = `ordererOrganizations/${domain}/orderers/${ordererServiceName}.${domain}`;
	const ordererService = {
		image: `hyperledger/fabric-orderer:${IMAGE_TAG}`,
		command: 'orderer',
		ports: [`${ordererEachConfig.portHost}:7050`],
		volumes: [
			`${CONFIGTXVolume}:${CONFIGTX}`,
			`${MSPROOTVolume}:${MSPROOT}`],
		environment: [
			'ORDERER_GENERAL_LOGLEVEL=debug',
			'ORDERER_GENERAL_LISTENADDRESS=0.0.0.0',// TODO useless checking
			`ORDERER_GENERAL_TLS_ENABLED=${TLS}`,
			'ORDERER_GENERAL_GENESISMETHOD=file',
			`ORDERER_GENERAL_GENESISFILE=${CONFIGTX}/${BLOCK_FILE}`,
			//  NOTE remove ORDERER_GENERAL_GENESISFILE: panic: Unable to bootstrap orderer. Error reading genesis block file: open /etc/hyperledger/fabric/genesisblock: no such file or directory
			// NOTE when ORDERER_GENERAL_GENESISMETHOD=provisional  ORDERER_GENERAL_GENESISPROFILE=SampleNoConsortium -> panic: No system chain found.  If bootstrapping, does your system channel contain a consortiums group definition
			`ORDERER_GENERAL_LOCALMSPID=${mspId}`,
			`ORDERER_GENERAL_LOCALMSPDIR=${MSPROOT}/${ORDERER_STRUCTURE}/msp`,
			'GODEBUG=netdns=go' // aliyun only

		],
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
		ordererService.environment = [
			...ordererService.environment,
			'ORDERER_KAFKA_RETRY_SHORTINTERVAL=1s',
			'ORDERER_KAFKA_RETRY_SHORTTOTAL=30s',
			'ORDERER_KAFKA_VERBOSE=true'
		];
		ordererService.depends_on = kafkaServices;
	}

	if (TLS) {
		ordererService.environment = [...ordererService.environment,
			`ORDERER_GENERAL_TLS_PRIVATEKEY=${MSPROOT}/${ORDERER_STRUCTURE}/tls/server.key`,
			`ORDERER_GENERAL_TLS_CERTIFICATE=${MSPROOT}/${ORDERER_STRUCTURE}/tls/server.crt`,
			`ORDERER_GENERAL_TLS_ROOTCAS=[${ORDERER_GENERAL_TLS_ROOTCAS}${container.dir.MSPROOT}/${ORDERER_STRUCTURE}/tls/ca.crt]`
		];
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
	const COMPANY_DOMAIN = companyConfig.domain;
	const ordererConfig = companyConfig.orderer;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	// const ordererContainerPort = ordererConfig.portMap[0].container

	if (fs.existsSync(COMPOSE_FILE)) {
		fs.unlinkSync(COMPOSE_FILE);
	}

	const services = {};


	let ORDERER_GENERAL_TLS_ROOTCAS = '';


	for (const orgName in orgsConfig) {
		const orgConfig = orgsConfig[orgName];
		const orgDomain = `${orgName}.${COMPANY_DOMAIN}`;
		const peersConfig = orgConfig.peers;

		for (const peerIndex in peersConfig) {
			const peerDomain = `peer${peerIndex}.${orgDomain}`;
			const peerConfig = peersConfig[peerIndex];

			const PEER_STRUCTURE = `peerOrganizations/${orgDomain}/peers/${peerDomain}`;


			const tls =TLS?{
				serverKey:path.resolve(peerUtil.container.MSPROOT,PEER_STRUCTURE,'tls','server.key'),
				serverCrt:path.resolve(peerUtil.container.MSPROOT,PEER_STRUCTURE,'tls','server.crt'),
				caCrt:path.resolve(peerUtil.container.MSPROOT,PEER_STRUCTURE,'tls','ca.crt')
			}:undefined;
			const environment = peerUtil.envBuilder({network,msp:{
				configPath:path.resolve(peerUtil.container.MSPROOT,PEER_STRUCTURE,'msp'),
				id:orgConfig.MSP.id,
				peer_hostName_full:peerDomain
			},tls});
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
				peerService.environment.push('CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052');
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
		const caConfig = orgConfig.ca;
		if (caConfig.enable || type === 'swarm') {

			const FABRIC_CA_HOME = `${container.dir.CA_HOME}/peerOrganizations/${orgDomain}/ca`;
			const CAVolume = path.join(MSPROOT, 'peerOrganizations', orgDomain, 'ca');
			const caServerConfigFile = path.resolve(CAVolume, 'fabric-ca-server-config.yaml');
			if (fs.existsSync(caServerConfigFile)) {
				fs.unlinkSync(caServerConfigFile);
			}
			const caPrivateKey = helper.findKeyfiles(CAVolume)[0];
			// const caServerConfig = {
			// 	affiliations: {
			// 		[orgName]: ['client', 'user', 'peer']
			// 	},
			// 	tls: {
			// 		enabled: TLS
			// 	},
			// 	registry: {
			// 		identities: [
			// 			{
			// 				type: 'client',
			// 				name: caConfig.admin.name,
			// 				pass: caConfig.admin.pass,
			// 				maxenrollments: -1,
			// 				attrs: {
			// 					'hf.Registrar.Roles': 'client,user,peer',
			// 					'hf.Revoker': true,
			// 					'hf.Registrar.DelegateRoles': 'client,user',
			// 					'hf.Registrar.Attributes': '*'
			// 				}
			// 			}]
			// 	},
			// 	ca: {
			// 		certfile: `${FABRIC_CA_HOME}/ca.${orgDomain}-cert.pem`,
			// 		keyfile: `${FABRIC_CA_HOME}/${path.basename(caPrivateKey)}`
			// 	}
			// };

			let caContainerName;

			if (TLS) {
				//    FIXME? tlsca? what is this for
				ORDERER_GENERAL_TLS_ROOTCAS += `${container.dir.MSPROOT}/peerOrganizations/${orgDomain}/tlsca/tlsca.${orgDomain}-cert.pem,`;
				caContainerName = `tlsca.${orgDomain}`;
				// caServerConfig.tls = {
				// 	certfile: `${FABRIC_CA_HOME}/ca.${orgDomain}-cert.pem`,
				// 	keyfile: `${FABRIC_CA_HOME}/${path.basename(caPrivateKey)}`
				// };
			} else {
				caContainerName = `ca.${orgDomain}`;

			}
			const caService = {
				image: `hyperledger/fabric-ca:${IMAGE_TAG}`,
				command: `sh -c 'fabric-ca-server start -d -b ${caConfig.admin.name}:${caConfig.admin.pass}'`,
				ports: [`${caConfig.portHost}:7054`],
				environment: [
					'GODEBUG=netdns=go'//NOTE aliyun only
				]
			};
			let caServiceName = caContainerName;
			if (type === 'swarm') {
				caService.networks = {
					default: {
						aliases: [caContainerName]
					}
				};
				caServiceName = swarmServiceName(caServiceName);
				//TODO network map service here


			} else {
				caService.container_name = caContainerName;
				caService.networks = ['default'];

			}
			services[caServiceName] = caService;
			// fs.writeFileSync(caServerConfigFile, yaml.safeDump(caServerConfig, {lineWidth: 180}));

		}

	}


	if (companyConfig.orderer.type === 'kafka') {
		const kafkaConfigs = companyConfig.orderer.kafka.kafkas;
		const zkConfigs = companyConfig.orderer.kafka.zookeepers;
		const BLOCK_FILE = companyConfig.orderer.genesis_block.file;
		for (const ordererOrgName in companyConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = companyConfig.orderer.kafka.orgs[ordererOrgName];
			const mspId = ordererOrgConfig.MSP.id;
			for (const ordererName in ordererOrgConfig.orderers) {
				const ordererEachConfig = ordererOrgConfig.orderers[ordererName];


				addOrdererService(services, {BLOCK_FILE, mspId, ordererEachConfig, CONFIGTXVolume, MSPROOTVolume}, {
					ordererName, domain:ordererOrgName, IMAGE_TAG,
					swarmType: type, ORDERER_GENERAL_TLS_ROOTCAS,
					kafkaServices: Object.keys(kafkaConfigs)
				});

			}
		}


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
					`KAFKA_DEFAULT_REPLICATION_FACTOR=${companyConfig.orderer.kafka.N}`,
					`KAFKA_MIN_INSYNC_REPLICAS=${companyConfig.orderer.kafka.M}`
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
			if (type === 'swarm') {

			} else {
				services[kafka].container_name = kafka;
			}
		}
	} else {
		const ordererEachConfig = companyConfig.orderer.solo;
		const BLOCK_FILE = companyConfig.orderer.genesis_block.file;
		const mspId = companyConfig.orderer.solo.MSP.id;
		addOrdererService(services, {BLOCK_FILE, mspId, ordererEachConfig, CONFIGTXVolume, MSPROOTVolume}, {
			ordererName: ordererEachConfig.container_name, domain:COMPANY_DOMAIN, IMAGE_TAG,
			swarmType: type, ORDERER_GENERAL_TLS_ROOTCAS,
			kafkaServices: undefined
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
	COMPOSE_FILE = path.resolve(CURRENT, 'docker-ca-compose.yaml')
}) => {
	logger.debug({arch, COMPOSE_FILE});

	const {docker: {fabricTag, network}, orderer: {type}} = globalConfig;
	const IMAGE_TAG = `${arch}-${fabricTag}`;

	const peerOrgsConfig = globalConfig.orgs;

	const COMPANY_DOMAIN = globalConfig.domain;

	if (fs.existsSync(COMPOSE_FILE)) {
		fs.unlinkSync(COMPOSE_FILE);
	}

	const services = {};
	if (type === 'kafka') {
		for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrg];
			const caConfig = ordererOrgConfig.ca;
			module.exports.addCA(services, {caConfig}, {orgDomain: ordererOrg, IMAGE_TAG});
		}
	} else {
		const {ca, container_name} = globalConfig.orderer.solo;
		module.exports.addCA(services, {caConfig: ca}, {orgDomain: container_name, IMAGE_TAG});
	}

	for (const orgName in peerOrgsConfig) {
		const orgConfig = peerOrgsConfig[orgName];
		const caConfig = orgConfig.ca;

		const orgDomain = `${orgName}.${COMPANY_DOMAIN}`;

		module.exports.addCA(services, {caConfig}, {orgDomain, IMAGE_TAG});
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
 * @param orgDomain
 * @param TLS
 * @param IMAGE_TAG
 */
exports.addCA = (services, {caConfig}, {orgDomain, IMAGE_TAG}) => {
	const {TLS} = globalConfig;
	let caContainerName;

	if (TLS) {
		caContainerName = `tlsca.${orgDomain}`;
	} else {
		caContainerName = `ca.${orgDomain}`;
	}
	const caService = {
		image: `hyperledger/fabric-ca:${IMAGE_TAG}`,
		command: 'fabric-ca-server start -d -b admin:passwd',
		ports: [`${caConfig.portHost}:7054`],
		environment: [
			'GODEBUG=netdns=go',//NOTE aliyun only
		],
		container_name:caContainerName
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
