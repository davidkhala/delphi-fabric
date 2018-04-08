const globalConfig = require('./orgs.json');
const fs = require('fs');
const path = require('path');
const CURRENT = __dirname;
const yaml = require('js-yaml');
const helper = require('../app/helper');
const logger = require('../app/util/logger').new('compose-gen');
const swarmServiceName = (serviceName) => {
	return serviceName.replace(/\./g, '-');
};
const addOrdererService = (services, {ordererConfig, ordererEachConfig, MSPROOTVolume, CONFIGTXVolume}, {
	ordererName, COMPANY_DOMAIN, IMAGE_TAG,
	ORDERER_GENERAL_TLS_ROOTCAS,
	kafkaServices, TLS, swarmType = 'local',
	CONFIGTX = '/etc/hyperledger/configtx',
	MSPROOT = '/etc/hyperledger/crypto-config',
}) => {

	const BLOCK_FILE = ordererConfig.genesis_block.file;
	let ordererServiceName = ordererName;
	const ORDERER_STRUCTURE = `ordererOrganizations/${COMPANY_DOMAIN}/orderers/${ordererServiceName}.${COMPANY_DOMAIN}`;
	const ordererService = {
		image: `hyperledger/fabric-orderer:${IMAGE_TAG}`,
		command: 'orderer',
		ports: [`${ordererEachConfig.portMap[7050]}:7050`],
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
			`ORDERER_GENERAL_LOCALMSPID=${ordererConfig.MSP.id}`,// FIXME hardcode MSP name
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
		//TODO network map service here
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
	const dockerSock = '/host/var/run/docker.sock';
	const orgsConfig = companyConfig.orgs;
	const COMPANY_DOMAIN = companyConfig.domain;
	const ordererConfig = companyConfig.orderer;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	// const ordererContainerPort = ordererConfig.portMap[0].container
	const container =
        {
        	dir: {
        		CONFIGTX: '/etc/hyperledger/configtx',
        		MSPROOT: '/etc/hyperledger/crypto-config',
        		CA_HOME: '/etc/hyperledger/fabric-ca-server'
        	}
        };
	if (fs.existsSync(COMPOSE_FILE)) {
		fs.unlinkSync(COMPOSE_FILE);
	}

	const services = {};


	let ORDERER_GENERAL_TLS_ROOTCAS = '';


	for (let orgName in orgsConfig) {
		const orgConfig = orgsConfig[orgName];
		const orgDomain = `${orgName}.${COMPANY_DOMAIN}`;
		const peersConfig = orgConfig.peers;

		for (let peerIndex in peersConfig) {
			const peerDomain = `peer${peerIndex}.${orgDomain}`;
			const peerConfig = peersConfig[peerIndex];

			const PEER_STRUCTURE = `peerOrganizations/${orgDomain}/peers/${peerDomain}`;
			const environment =
                [
                	`CORE_VM_ENDPOINT=unix://${dockerSock}`,
                	`CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=${network}`,
                	'CORE_LOGGING_LEVEL=DEBUG',
                	'CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true',
                	'CORE_PEER_GOSSIP_USELEADERELECTION=true',
                	'CORE_PEER_GOSSIP_ORGLEADER=false',
                	`CORE_PEER_GOSSIP_EXTERNALENDPOINT=${peerDomain}:7051`, // FIXME take care!
                	`CORE_PEER_LOCALMSPID=${orgConfig.MSP.id}`,
                	`CORE_PEER_MSPCONFIGPATH=${container.dir.MSPROOT}/${PEER_STRUCTURE}/msp`,
                	`CORE_PEER_TLS_ENABLED=${TLS}`,
                	`CORE_PEER_ID=${peerDomain}`,
                	`CORE_PEER_ADDRESS=${peerDomain}:7051`,
                	'CORE_CHAINCODE_EXECUTETIMEOUT=180s',

                	'GODEBUG=netdns=go'//NOTE aliyun only
                ];
			if (TLS) {
				environment.push(`CORE_PEER_TLS_KEY_FILE=${container.dir.MSPROOT}/${PEER_STRUCTURE}/tls/server.key`);
				environment.push(`CORE_PEER_TLS_CERT_FILE=${container.dir.MSPROOT}/${PEER_STRUCTURE}/tls/server.crt`);
				environment.push(`CORE_PEER_TLS_ROOTCERT_FILE=${container.dir.MSPROOT}/${PEER_STRUCTURE}/tls/ca.crt`);
			}
			const ports = [];
			for (let portIndex in peerConfig.portMap) {
				const entry = peerConfig.portMap[portIndex];
				ports.push(`${entry.host}:${entry.container}`);
			}
			const peerService = {
				depends_on: companyConfig.orderer.type === 'kafka' ?
					Object.keys(companyConfig.orderer.kafka.orderers)
					: [companyConfig.orderer.solo.container_name],
				image: `hyperledger/fabric-peer:${IMAGE_TAG}`,
				command: 'peer node start',
				environment,
				ports,
				volumes: [
					`/run/docker.sock:${dockerSock}`,
					`${MSPROOTVolume}:${container.dir.MSPROOT}`]
			};

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
		if (caConfig.enable) {

			const FABRIC_CA_HOME = `${container.dir.CA_HOME}/peerOrganizations/${orgDomain}/ca`;
			const CAVolume = path.join(MSPROOT, 'peerOrganizations', orgDomain, 'ca');
			const caServerConfigFile = path.resolve(CAVolume, 'fabric-ca-server-config.yaml');
			if (fs.existsSync(caServerConfigFile)) {
				fs.unlinkSync(caServerConfigFile);
			}
			const caPrivateKey = helper.findKeyfiles(CAVolume)[0];
			const caServerConfig = {
				affiliations: {
					[orgName]: ['client', 'user', 'peer']
				},
				tls: {
					enabled: TLS
				},
				registry: {
					identities: [
						{
							type: 'client',
							name: caConfig.admin.name,
							pass: caConfig.admin.pass,
							maxenrollments: -1,
							attrs: {
								'hf.Registrar.Roles': 'client,user,peer',
								'hf.Revoker': true,
								'hf.Registrar.DelegateRoles': 'client,user',
								'hf.Registrar.Attributes': '*'
							}
						}]
				},
				ca: {
					certfile: `${FABRIC_CA_HOME}/ca.${orgDomain}-cert.pem`,
					keyfile: `${FABRIC_CA_HOME}/${path.basename(caPrivateKey)}`
				}
			};

			let caContainerName;

			if (TLS) {
				//    FIXME? tlsca? what is this for
				ORDERER_GENERAL_TLS_ROOTCAS += `${container.dir.MSPROOT}/peerOrganizations/${orgDomain}/tlsca/tlsca.${orgDomain}-cert.pem,`;
				caContainerName = `tlsca.${orgDomain}`;
				caServerConfig.tls = {
					certfile: `${FABRIC_CA_HOME}/ca.${orgDomain}-cert.pem`,
					keyfile: `${FABRIC_CA_HOME}/${path.basename(caPrivateKey)}`
				};
			} else {
				caContainerName = `ca.${orgDomain}`;

			}
			const caService = {
				image: `hyperledger/fabric-ca:${IMAGE_TAG}`,
				command: 'sh -c \'fabric-ca-server start -d\'',
				volumes: [`${MSPROOTVolume}:${container.dir.CA_HOME}`],
				ports: [`${caConfig.portHost}:7054`],
				environment: [
					`FABRIC_CA_HOME=${FABRIC_CA_HOME}`,
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
			fs.writeFileSync(caServerConfigFile, yaml.safeDump(caServerConfig, {lineWidth: 180}));

		}

	}


	if (companyConfig.orderer.type === 'kafka') {
		const ordererConfigs = companyConfig.orderer.kafka.orderers;
		const kafkaConfigs = companyConfig.orderer.kafka.kafkas;
		const zkConfigs = companyConfig.orderer.kafka.zookeepers;
		for (let ordererName in ordererConfigs) {
			const ordererEachConfig = ordererConfigs[ordererName];

			addOrdererService(services, {ordererConfig, ordererEachConfig, CONFIGTXVolume, MSPROOTVolume}, {
				ordererName, COMPANY_DOMAIN, TLS, IMAGE_TAG,
				swarmType: type, ORDERER_GENERAL_TLS_ROOTCAS,
				kafkaServices: Object.keys(kafkaConfigs)
			});

		}


		let KAFKA_ZOOKEEPER_CONNECT = 'KAFKA_ZOOKEEPER_CONNECT=';
		for (let zookeeper in zkConfigs) {
			KAFKA_ZOOKEEPER_CONNECT += `${zookeeper}:2181,`;
		}
		KAFKA_ZOOKEEPER_CONNECT = KAFKA_ZOOKEEPER_CONNECT.substring(0, KAFKA_ZOOKEEPER_CONNECT.length - 1);
		for (let zookeeper in zkConfigs) {
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
			for (let zookeeper in zkConfigs) {
				const zkConfig2 = zkConfigs[zookeeper];
				if (type === 'swarm' && zkConfig === zkConfig2) {
					ZOO_SERVERS += `server.${zkConfig2.MY_ID}=0.0.0.0:2888:3888 `;
				} else {
					ZOO_SERVERS += `server.${zkConfig2.MY_ID}=${zookeeper}:2888:3888 `;
				}
			}
			services[zookeeper].environment.push(ZOO_SERVERS);
		}
		for (let kafka in kafkaConfigs) {
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
		addOrdererService(services, {ordererConfig, ordererEachConfig, CONFIGTXVolume, MSPROOTVolume}, {
			ordererName: ordererEachConfig.container_name, COMPANY_DOMAIN, TLS, IMAGE_TAG,
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
