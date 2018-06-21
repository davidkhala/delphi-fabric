const globalConfig = require('./config/orgs.json');
const fsExtra = require('fs-extra');
const path = require('path');
const util = require('util');
const logger = require('./common/nodejs/logger').new('dockerode-bootstrap');
const peerUtil = require('./common/nodejs/peer');
const {
	deployCA, runCA,
	deployKafka, runKafka, runZookeeper, deployZookeeper,
	deployPeer, runPeer, runOrderer, deployOrderer,
	chaincodeClean, tasksWaitUntilLive, fabricImagePull, tasksWaitUntilDead
	, swarmRenew
} = require('./common/nodejs/fabric-dockerode');
const channelUtil = require('./common/nodejs/channel');
const {CryptoPath, homeResolve} = require('./common/nodejs/path');
const {PM2} = require('./common/nodejs/express/pm2Manager');
const MSPROOT = homeResolve(globalConfig.docker.volumes.MSPROOT.dir);
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX.dir);
const arch = 'x86_64';
const {
	containerDelete, volumeCreateIfNotExist, networkCreateIfNotExist,
	swarmServiceName, constraintSelf, serviceDelete,
	volumeRemove, prune: {system: pruneSystem},
} = require('./common/docker/nodejs/dockerode-util');
const {advertiseAddr, joinToken} = require('./common/docker/nodejs/dockerCmd');
const {hostname} = require('./common/nodejs/helper');
const {docker: {fabricTag, network, thirdPartyTag}, TLS} = globalConfig;

const serverClient = require('./common/nodejs/express/serverClient');
const exec = util.promisify(require('child_process').exec);
const runConfigtxGenShell = path.resolve(__dirname, 'common', 'bin-manage', 'runConfigtxgen.sh');
const nodeServers = {
	swarmServer: path.resolve(__dirname, 'swarm', 'swarmServerPM2.js'),
	signServer: path.resolve(__dirname, 'cluster', 'leaderNode', 'signServerPM2.js')
};
const configtxlatorServer = require('./common/bin-manage/runConfigtxlator');

exports.runOrderers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, toStop, swarm) => {
	const {orderer: {type, genesis_block: {file: BLOCK_FILE}}} = globalConfig;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	const imageTag = `${arch}-${fabricTag}`;
	const {MSPROOT} = peerUtil.container;
	const cryptoType = 'orderer';
	const orderers = [];

	const toggle = async ({orderer, domain, port, id}, toStop, swarm, kafka) => {
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
				if (service) orderers.push(service);
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
						id
					}, CONFIGTXVolume, BLOCK_FILE,
					kafkas: kafka,
					tls,
					Constraints,
				});
				orderers.push(service);
			} else {
				await runOrderer({
					container_name, imageTag, port, network,
					BLOCK_FILE, CONFIGTXVolume,
					msp: {
						id,
						configPath,
						volumeName: MSPROOTVolume
					},
					kafkas: kafka,
					tls
				});
			}
		}
	};
	if (type === 'kafka') {
		const ordererOrgs = globalConfig.orderer.kafka.orgs;
		for (const domain in ordererOrgs) {
			const ordererOrgConfig = ordererOrgs[domain];
			const {MSP: {id}} = ordererOrgConfig;
			for (const orderer in ordererOrgConfig.orderers) {
				const ordererConfig = ordererOrgConfig.orderers[orderer];
				const port = ordererConfig.portHost;
				await toggle({orderer, domain, port, id}, toStop, swarm, true);
			}
		}
	} else {
		const ordererConfig = globalConfig.orderer.solo;
		const {orgName: domain, MSP: {id}, portHost: port} = ordererConfig;
		const orderer = ordererConfig.container_name;
		await toggle({orderer, domain, port, id}, toStop, swarm, undefined);
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
		const path = homeResolve(globalConfig.docker.volumes[Name].dir);
		await volumeCreateIfNotExist({Name, path});
	}
};
exports.runPeers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, tostop, swarm) => {
	const imageTag = `${arch}-${fabricTag}`;
	const orgsConfig = globalConfig.orgs;
	const peers = [];
	for (const domain in orgsConfig) {
		const orgConfig = orgsConfig[domain];
		const peersConfig = orgConfig.peers;

		const {MSP: {id}} = orgConfig;
		for (const peerIndex in peersConfig) {
			const peerConfig = peersConfig[peerIndex];
			const {container_name, portMap} = peerConfig;

			if (tostop) {
				if (swarm) {
					const service = await serviceDelete(swarmServiceName(container_name));
					if (service) peers.push(service);
				} else {
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

			const port = portMap.find(portEntry => portEntry.container === 7051).host;
			const eventHubPort = portMap.find(portEntry => portEntry.container === 7053).host;
			const type = 'peer';
			const configPath = cryptoPath.MSP(type);
			if (swarm) {
				const Constraints = await constraintSelf();

				const peer = await deployPeer({
					Name: container_name, port, eventHubPort, imageTag, network,
					peerHostName,
					msp: {
						id,
						volumeName: volumeName.MSPROOT,
						configPath,
					},
					tls,
					Constraints,
				});
				peers.push(peer);
			} else {
				await runPeer({
					container_name, port, eventHubPort, imageTag, network,
					peerHostName, tls,
					msp: {
						id,
						volumeName: volumeName.MSPROOT,
						configPath,
					}
				});
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

	const imageTag = `${arch}-${fabricTag}`;

	const CAs = [];
	const toggle = async ({container_name, port}, toStop, swarm) => {
		const serviceName = swarmServiceName(container_name);

		if (toStop) {
			if (swarm) {
				const service = await serviceDelete(serviceName);
				if (service) CAs.push(service);
			} else {
				await containerDelete(container_name);
			}
		} else {
			if (swarm) {
				const service = await deployCA({Name: container_name, network, imageTag, port, TLS});
				CAs.push(service);
			} else {
				await runCA({container_name, port, network, imageTag, TLS});
			}
		}
	};
	if (type === 'kafka') {
		for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrg];
			const {portHost: port} = ordererOrgConfig.ca;
			const container_name = `ca.${ordererOrg}`;
			await toggle({container_name, port}, toStop, swarm);
		}
	} else {
		const {ca: {portHost: port}, orgName} = globalConfig.orderer.solo;
		const container_name = `ca.${orgName}`;
		await toggle({container_name, port}, toStop, swarm);
	}

	for (const orgName in peerOrgsConfig) {
		const orgConfig = peerOrgsConfig[orgName];
		const {ca: {portHost: port}} = orgConfig;
		const container_name = `ca.${orgName}`;
		await toggle({container_name, port}, toStop, swarm);
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
	const imageTag = `${arch}-${thirdPartyTag}`;
	const zookeepers = [];
	for (const zookeeper in zkConfigs) {
		const zkConfig = zkConfigs[zookeeper];
		const {MY_ID} = zkConfig;
		if (toStop) {
			if (swarm) {
				const service = await serviceDelete(zookeeper);
				if (service) zookeepers.push(service);
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
	const imageTag = `${arch}-${thirdPartyTag}`;

	const kafkas = [];
	for (const kafka in kafkaConfigs) {
		const kafkaConfig = kafkaConfigs[kafka];
		const {BROKER_ID} = kafkaConfig;
		if (toStop) {
			if (swarm) {
				const service = await serviceDelete(kafka);
				if (service) kafkas.push(service);
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
		await pruneSystem(swarm);
		await chaincodeClean();
		await exports.volumesAction(toStop);

		const nodeAppConfigJson = require('./app/config');
		fsExtra.removeSync(nodeAppConfigJson.stateDBCacheDir);
		logger.info(`[done] clear stateDBCacheDir ${nodeAppConfigJson.stateDBCacheDir}`);


		fsExtra.removeSync(MSPROOT);
		logger.info(`[done] clear MSPROOT ${MSPROOT}`);
		fsExtra.removeSync(CONFIGTX);
		logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);
		for (const [name, script] of Object.entries(nodeServers)) {
			const pm2 = await new PM2().connect();
			await pm2.delete({name, script});
			pm2.disconnect();
		}
		require('./swarm/swarmServer').clean();
		require('./cluster/leaderNode/signServer').clean();

		await configtxlatorServer.run('down');

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
			const {port} = require('./swarm/swarm').swarmServer;
			const swarmServerUrl = `http://localhost:${port}`;
			await serverClient.ping(swarmServerUrl);
			await serverClient.leader.update(swarmServerUrl, {ip, hostname: hostname(), managerToken});
		}
		await configtxlatorServer.run('up');

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
		await exec(`${runConfigtxGenShell} block create ${path.resolve(CONFIGTX, BLOCK_FILE)} -p ${PROFILE_BLOCK} -i ${config_dir}`);

		const channelsConfig = globalConfig.channels;
		for (const channelName in channelsConfig) {
			channelUtil.nameMatcher(channelName, true);
			const channelConfig = channelsConfig[channelName];
			const channelFile = path.resolve(CONFIGTX, channelConfig.file);
			await exec(`${runConfigtxGenShell} channel create ${channelFile} -p ${channelName} -i ${config_dir} -c ${channelName}`);
		}


		await exports.runOrderers(undefined, undefined, swarm);

		await exports.runPeers(undefined, undefined, swarm);

	} catch (err) {
		logger.error(err);
		process.exit(1);
	}

	logger.debug('[done] up');

};
