const globalConfig = require('./config/orgs.json');
const path = require('path');
const logger = require('./common/nodejs/logger').new('dockerode-bootstrap');
const peerUtil = require('./common/nodejs/peer');
const {
	runCouchDB,
	deployCA, runCA,
	deployKafka, runKafka, runZookeeper, deployZookeeper,
	deployPeer, runPeer, runOrderer, deployOrderer,
	chaincodeClean, tasksWaitUntilLive, fabricImagePull, tasksWaitUntilDead
	, swarmRenew
} = require('./common/nodejs/fabric-dockerode');
const ClientUtil = require('./common/nodejs/client');
const {CryptoPath} = require('./common/nodejs/path');
const {nodeUtil} = require('./common/nodejs/helper');
const {PM2} = require('khala-pm2');
const {ping} = nodeUtil.request();
const {projectResolve} = require('./app/helper');
const MSPROOT = projectResolve(globalConfig.docker.volumes.MSPROOT.dir);
const CONFIGTX = projectResolve(globalConfig.docker.volumes.CONFIGTX.dir);
const arch = 'x86_64';
const {
	containerDelete, volumeCreateIfNotExist, networkCreateIfNotExist,
	volumeRemove, prune: {system: pruneLocalSystem}
} = require('./common/docker/nodejs/dockerode-util');
const {swarmServiceName, constraintSelf, serviceDelete, prune: {system: pruneSwarmSystem}} = require('./common/docker/nodejs/dockerode-swarm-util');
const {advertiseAddr, joinToken} = require('./common/docker/nodejs/dockerCmd');
const {hostname, exec, homeResolve, fsExtra} = require('./common/nodejs/helper').nodeUtil.helper();
const {docker: {fabricTag, network, thirdPartyTag}, TLS} = globalConfig;

const serverClient = require('./swarm/serverClient');
const runConfigtxGenShell = path.resolve(__dirname, 'common', 'bin-manage', 'runConfigtxgen.sh');
const nodeServers = {
	swarmServer: path.resolve(__dirname, 'swarm', 'swarmServerPM2.js'),
	signServer: path.resolve(__dirname, 'swarm', 'signServerPM2.js')
};
const {configtxlator} = require('./common/nodejs/binManager');

exports.runOrderers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, toStop, swarm) => {
	const {orderer: {type, genesis_block: {file: BLOCK_FILE}}} = globalConfig;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	const imageTag = fabricTag;
	const {MSPROOT} = peerUtil.container;
	const cryptoType = 'orderer';
	const orderers = [];

	const toggle = async ({orderer, domain, port, mspid}, kafka, stateVolume, operations) => {
		const cryptoPath = new CryptoPath(MSPROOT, {
			orderer: {org: domain, name: orderer}
		});

		const {ordererHostName} = cryptoPath;
		const container_name = ordererHostName;
		const serviceName = swarmServiceName(container_name);
		const configPath = cryptoPath.MSP(cryptoType);

		if (toStop) {
			if (swarm) {
				const service = await serviceDelete(serviceName);
				if (service) {
					orderers.push(service);
				}
			} else {
				await containerDelete(container_name);
			}
		} else {
			const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;
			if (swarm) {
				const Constraints = await constraintSelf();
				const service = await deployOrderer({
					Name: container_name,
					imageTag,
					network,
					port,
					msp: {
						volumeName: MSPROOTVolume,
						configPath,
						id: mspid
					}, CONFIGTXVolume, BLOCK_FILE,
					kafkas: kafka,
					tls,
					Constraints
				});
				orderers.push(service);
			} else {
				await runOrderer({
					container_name, imageTag, port, network,
					BLOCK_FILE, CONFIGTXVolume,
					msp: {
						id: mspid,
						configPath,
						volumeName: MSPROOTVolume
					},
					kafkas: kafka,
					tls, stateVolume
				}, operations);
			}
		}
	};
	if (type === 'kafka') {
		const ordererOrgs = globalConfig.orderer.kafka.orgs;
		for (const domain in ordererOrgs) {
			const ordererOrgConfig = ordererOrgs[domain];
			const {mspid} = ordererOrgConfig;
			for (const orderer in ordererOrgConfig.orderers) {
				const ordererConfig = ordererOrgConfig.orderers[orderer];
				let {stateVolume} = ordererConfig;
				if (stateVolume) {
					stateVolume = homeResolve(stateVolume);
				}
				const {portHost, operations} = ordererConfig;
				await toggle({orderer, domain, port: portHost, mspid}, true, stateVolume, operations);
			}
		}
	} else {
		const ordererConfig = globalConfig.orderer.solo;
		const {orgName: domain, mspid, portHost: port, operations} = ordererConfig;
		const orderer = ordererConfig.container_name;
		let {stateVolume} = ordererConfig;
		if (stateVolume) {
			stateVolume = homeResolve(stateVolume);
		}
		await toggle({orderer, domain, port, mspid}, undefined, stateVolume, operations);
	}
	if (swarm) {
		if (toStop) {
			await tasksWaitUntilDead({services: orderers});
		} else {
			await tasksWaitUntilLive(orderers);
		}
	}
};

exports.volumesAction = async (toStop) => {
	for (const Name in globalConfig.docker.volumes) {
		if (toStop) {
			await volumeRemove(Name);
			continue;
		}
		const path = projectResolve(globalConfig.docker.volumes[Name].dir);
		await volumeCreateIfNotExist({Name, path});
	}
};
exports.runPeers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, tostop, swarm) => {
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
				if (swarm) {
					const service = await serviceDelete(swarmServiceName(container_name));
					if (couchDB) {
						const service = await serviceDelete(swarmServiceName(couchDB.container_name));
						if (service) {
							peers.push(service);
						}
					}
					if (service) {
						peers.push(service);
					}
				} else {
					if (couchDB) {
						await containerDelete(couchDB.container_name);
					}
					await containerDelete(container_name);
				}
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
			if (swarm) {
				const Constraints = await constraintSelf();
				// if (couchDB) {
				// 	const {container_name, port} = couchDB;
				// 	await runCouchDB({imageTag: thirdPartyTag, container_name, port, network});
				// }

				const peer = await deployPeer({
					Name: container_name, port, imageTag, network,
					peerHostName,
					msp: {
						id: mspid,
						volumeName: volumeName.MSPROOT,
						configPath
					},
					tls,
					Constraints,
					couchDB
				});
				peers.push(peer);
			} else {
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

	}
	if (swarm) {
		if (tostop) {
			await tasksWaitUntilDead({services: peers});
		} else {
			await tasksWaitUntilLive(peers);
		}
	}
};

exports.runCAs = async (toStop, swarm) => {
	const {orderer: {type}, orgs: peerOrgsConfig} = globalConfig;

	const imageTag = fabricTag;

	const CAs = [];
	const toggle = async ({container_name, port, Issuer}) => {
		const serviceName = swarmServiceName(container_name);

		if (toStop) {
			if (swarm) {
				const service = await serviceDelete(serviceName);
				if (service) {
					CAs.push(service);
				}
			} else {
				await containerDelete(container_name);
			}
		} else {
			if (swarm) {
				const service = await deployCA({Name: container_name, network, imageTag, port, TLS});
				CAs.push(service);
			} else {
				await runCA({container_name, port, network, imageTag, TLS, Issuer});
			}
		}
	};
	if (type === 'kafka') {
		for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrg];
			const {portHost: port} = ordererOrgConfig.ca;
			const container_name = `ca.${ordererOrg}`;
			const Issuer = {CN: ordererOrg};
			await toggle({container_name, port, Issuer});
		}
	} else {
		const {ca: {portHost: port}, orgName} = globalConfig.orderer.solo;
		const container_name = `ca.${orgName}`;
		const Issuer = {CN: orgName};
		await toggle({container_name, port, Issuer});
	}

	for (const orgName in peerOrgsConfig) {
		const orgConfig = peerOrgsConfig[orgName];
		const {ca: {portHost: port}} = orgConfig;
		const container_name = `ca.${orgName}`;
		const Issuer = {CN: orgName};
		await toggle({container_name, port, Issuer});
	}
	if (swarm) {
		if (toStop) {
			await tasksWaitUntilDead({services: CAs});
		} else {
			await tasksWaitUntilLive(CAs);
		}
	}
};

exports.runZookeepers = async (toStop, swarm) => {
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const imageTag = thirdPartyTag;
	const zookeepers = [];
	for (const zookeeper in zkConfigs) {
		const zkConfig = zkConfigs[zookeeper];
		const {MY_ID} = zkConfig;
		if (toStop) {
			if (swarm) {
				const service = await serviceDelete(zookeeper);
				if (service) {
					zookeepers.push(service);
				}
			} else {
				await containerDelete(zookeeper);
			}
		} else {
			if (swarm) {
				const service = await deployZookeeper({
					Name: zookeeper, network, imageTag, MY_ID
				}, zkConfigs);
				zookeepers.push(service);
			} else {
				await runZookeeper({
					container_name: zookeeper, MY_ID, imageTag, network
				}, zkConfigs);
			}
		}
	}
	if (swarm) {
		if (toStop) {
			await tasksWaitUntilDead({services: zookeepers});
		} else {
			await tasksWaitUntilLive(zookeepers);
		}
	}
};
exports.runKafkas = async (toStop, swarm) => {
	const kafkaConfigs = globalConfig.orderer.kafka.kafkas;
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const zookeepers = Object.keys(zkConfigs);
	const {N, M} = globalConfig.orderer.kafka;
	const imageTag = thirdPartyTag;

	const kafkas = [];
	for (const kafka in kafkaConfigs) {
		const kafkaConfig = kafkaConfigs[kafka];
		const {BROKER_ID} = kafkaConfig;
		if (toStop) {
			if (swarm) {
				const service = await serviceDelete(kafka);
				if (service) {
					kafkas.push(service);
				}
			} else {
				await containerDelete(kafka);
			}
		} else {
			if (swarm) {
				const service = await deployKafka({
					Name: kafka, network, imageTag, BROKER_ID
				}, zookeepers, {N, M});
				kafkas.push(service);
			} else {
				await runKafka({
					container_name: kafka, network, imageTag, BROKER_ID
				}, zookeepers, {N, M});
			}
		}

	}
	if (swarm) {
		if (toStop) {
			await tasksWaitUntilDead({services: kafkas});
		} else {
			await tasksWaitUntilLive(kafkas);
		}
	}
};
exports.down = async (swarm) => {
	const {orderer: {type}} = globalConfig;

	const toStop = true;
	try {
		if (swarm) {
			await swarmRenew();
		}
		await exports.runCAs(toStop, swarm);

		await exports.runPeers(undefined, toStop, swarm);
		await exports.runOrderers(undefined, toStop, swarm);
		if (type === 'kafka') {
			await exports.runKafkas(toStop, swarm);
			await exports.runZookeepers(toStop, swarm);
		}
		if (swarm) {
			await pruneSwarmSystem();
		}
		await pruneLocalSystem();
		await chaincodeClean(true);
		await exports.volumesAction(toStop);

		fsExtra.emptyDirSync(MSPROOT);
		logger.info(`[done] clear MSPROOT ${MSPROOT}`);
		fsExtra.emptyDirSync(CONFIGTX);
		logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);
		for (const [name, script] of Object.entries(nodeServers)) {
			const pm2 = await new PM2().connect();
			await pm2.delete({name, script});
			pm2.disconnect();
		}
		require('./swarm/swarmServer').clean();
		require('./swarm/signServer').clean();

		await configtxlator('down');
		ClientUtil.clean();
	} catch (err) {
		logger.error(err);
		process.exit(1);
	}
	logger.debug('[done] down');
};

exports.up = async (swarm) => {
	try {
		await fabricImagePull({fabricTag, thirdPartyTag, arch});
		for (const [name, script] of Object.entries(nodeServers)) {
			const pm2 = await new PM2().connect();
			await pm2.reRun({name, script});
			pm2.disconnect();
		}
		logger.info('[start]swarm Server init steps');
		if (swarm) {
			await swarmRenew();

			const {address: ip} = await advertiseAddr();
			const managerToken = await joinToken();
			const workerToken = await joinToken('worker');
			const {port} = require('./swarm/swarm').swarmServer;
			const swarmServerUrl = `http://localhost:${port}`;
			await ping(swarmServerUrl);
			await serverClient.leader.update(swarmServerUrl, {ip, hostname: hostname(), managerToken, workerToken});
		}
		await configtxlator('up');

		await networkCreateIfNotExist({Name: network}, swarm);

		const {orderer: {type}} = globalConfig;
		await exports.volumesAction();
		await exports.runCAs(undefined, swarm);

		if (type === 'kafka') {
			await exports.runZookeepers(undefined, swarm);
			await exports.runKafkas(undefined, swarm);
		}
		await require('./config/caCryptoGen').genAll(swarm);

		const PROFILE_BLOCK = globalConfig.orderer.genesis_block.profile;
		const configtxFile = path.resolve(__dirname, 'config', 'configtx.yaml');
		require('./config/configtx.js').gen({MSPROOT, PROFILE_BLOCK, configtxFile});


		const BLOCK_FILE = globalConfig.orderer.genesis_block.file;
		const config_dir = path.dirname(configtxFile);
		fsExtra.ensureDirSync(CONFIGTX);
		await exec(`export FABRIC_CFG_PATH=${config_dir} && ${runConfigtxGenShell} genBlock ${path.resolve(CONFIGTX, BLOCK_FILE)} ${PROFILE_BLOCK}`);

		const channelsConfig = globalConfig.channels;
		for (const channelName in channelsConfig) {
			const channelConfig = channelsConfig[channelName];
			const channelFile = path.resolve(CONFIGTX, channelConfig.file);
			await exec(`export FABRIC_CFG_PATH=${config_dir} && ${runConfigtxGenShell} genChannel ${channelFile} ${channelName} ${channelName}`);
		}


		await exports.runOrderers(undefined, undefined, swarm);

		await exports.runPeers(undefined, undefined, swarm);

	} catch (err) {
		logger.error(err);
		process.exit(1);
	}

	logger.debug('[done] up');

};
