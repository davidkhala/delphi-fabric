const globalConfig = require('./orgs.json');
const fsExtra = require('fs-extra');
const path = require('path');
const logger = require('../common/nodejs/logger').new('dockerode-bootstrap');
const peerUtil = require('../common/nodejs/peer');
const {
	deployCA,runCA,
	deployKafka, runKafka, runZookeeper, deployZookeeper,
	deployPeer, runPeer, runOrderer, deployOrderer,
	chaincodeClean, tasksWaitUntilLive, imagePullCCENV,
} = require('../common/nodejs/fabric-dockerode');
const channelUtil = require('../common/nodejs/channel');
const {CryptoPath, homeResolve} = require('../common/nodejs/path');

const MSPROOT = homeResolve(globalConfig.docker.volumes.MSPROOT.dir);
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX.dir);
const arch = 'x86_64';
const {
	containerDelete, networkRemove, volumeCreateIfNotExist, networkCreateIfNotExist,
	swarmServiceName, serviceDelete, constraintSelf,
	volumeRemove, prune: {system: pruneSystem}
} = require('../common/docker/nodejs/dockerode-util');
const {docker: {fabricTag, network, thirdPartyTag}, TLS} = globalConfig;

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const runConfigtxGenShell = path.resolve(path.dirname(__dirname), 'common', 'bin-manage', 'runConfigtxgen.sh');

exports.runOrderers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, toStop, swarm) => {
	const {orderer: {type, genesis_block: {file: BLOCK_FILE}}} = globalConfig;
	const CONFIGTXVolume = volumeName.CONFIGTX;
	const MSPROOTVolume = volumeName.MSPROOT;
	const imageTag = `${arch}-${fabricTag}`;
	const {MSPROOT} = peerUtil.container;
	const cryptoType = 'orderer';
	const results = [];

	const toggle = async ({orderer, domain, port, id}, toStop, swarm, kafka) => {
		const cryptoPath = new CryptoPath(MSPROOT, {
			orderer: {org: domain, name: orderer}
		});
		const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;

		const {ordererHostName} = cryptoPath;
		const container_name = ordererHostName;
		const serviceName = swarmServiceName(container_name);
		const configPath = cryptoPath.MSP(cryptoType);

		if (toStop) {
			if (swarm) {
				return serviceDelete(serviceName);
			} else {
				return containerDelete(container_name);
			}
		} else {
			if (swarm) {
				const Constraints = await constraintSelf();
				return deployOrderer({
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
			} else {
				return runOrderer({
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
				const service = await toggle({orderer, domain, port, id}, toStop, swarm, true);
				results.push(service);
			}
		}
	} else {
		const ordererConfig = globalConfig.orderer.solo;
		const {orgName: domain, MSP: {id}, portHost: port} = ordererConfig;
		const orderer = ordererConfig.container_name;
		const service = await toggle({orderer, domain, port, id}, toStop, swarm, undefined);
		results.push(service);
	}
	return results;
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
	const results = [];
	if (!tostop) await imagePullCCENV(imageTag);
	for (const domain in orgsConfig) {
		const orgConfig = orgsConfig[domain];
		const peersConfig = orgConfig.peers;

		const {MSP: {id}} = orgConfig;
		for (const peerIndex in peersConfig) {
			const peerConfig = peersConfig[peerIndex];
			const {container_name, portMap} = peerConfig;

			if (tostop) {
				if (swarm) {
					await serviceDelete(swarmServiceName(container_name));
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
				results.push(peer);
			} else {
				const peer = await runPeer({
					container_name, port, eventHubPort, imageTag, network,
					peerHostName, tls,
					msp: {
						id,
						volumeName: volumeName.MSPROOT,
						configPath,
					}
				});
				results.push(peer);
			}

		}

	}
	return results;
};

exports.runCAs = async (toStop, swarm) => {
	const {orderer: {type}, orgs: peerOrgsConfig} = globalConfig;

	const imageTag = `${arch}-${fabricTag}`;

	const results = [];
	const toggle = async ({container_name, port}, toStop, swarm) => {
		const serviceName = swarmServiceName(container_name);

		if (toStop) {
			if (swarm) {
				return await serviceDelete(serviceName);
			} else {
				return await containerDelete(container_name);
			}
		} else {
			if (swarm) {
				return await deployCA({Name: container_name, network, imageTag, port, TLS});
			} else {
				return await runCA({container_name, port, network, imageTag, TLS});
			}
		}
	};
	if (type === 'kafka') {
		for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrg];
			const {portHost: port} = ordererOrgConfig.ca;
			const container_name = `ca.${ordererOrg}`;
			const service = await toggle({container_name, port}, toStop, swarm);
			results.push(service);
		}
	} else {
		const {ca: {portHost: port}, orgName} = globalConfig.orderer.solo;
		const container_name = `ca.${orgName}`;
		const service = await toggle({container_name, port}, toStop, swarm);
		results.push(service);

	}

	for (const orgName in peerOrgsConfig) {
		const orgConfig = peerOrgsConfig[orgName];
		const {ca: {portHost: port}} = orgConfig;
		const container_name = `ca.${orgName}`;

		const service = await toggle({container_name, port}, toStop, swarm);
		results.push(service);
	}
	return results;
};

exports.runZookeepers = async (toStop, swarm) => {
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const imageTag = `${arch}-${thirdPartyTag}`;
	const results = [];
	for (const zookeeper in zkConfigs) {
		const zkConfig = zkConfigs[zookeeper];
		const {MY_ID} = zkConfig;
		if (toStop) {
			if (swarm) {
				await serviceDelete(zookeeper);
			} else {
				await containerDelete(zookeeper);
			}
		} else {
			if (swarm) {
				const service = await deployZookeeper({
					Name: zookeeper, network, imageTag, MY_ID
				}, zkConfigs);
				results.push(service);
			} else {
				const container = await runZookeeper({
					container_name: zookeeper, MY_ID, imageTag, network
				}, zkConfigs);
				results.push(container);
			}
		}
	}
	return results;
};
exports.runKafkas = async (toStop, swarm) => {
	const kafkaConfigs = globalConfig.orderer.kafka.kafkas;
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const zookeepers = Object.keys(zkConfigs);
	const {N, M} = globalConfig.orderer.kafka;
	const imageTag = `${arch}-${thirdPartyTag}`;

	const results = [];
	for (const kafka in kafkaConfigs) {
		const kafkaConfig = kafkaConfigs[kafka];
		const {BROKER_ID} = kafkaConfig;
		if (toStop) {
			if (swarm) {
				await serviceDelete(kafka);
			} else {
				await containerDelete(kafka);
			}
		} else {
			if (swarm) {
				const service = await deployKafka({
					Name: kafka, network, imageTag, BROKER_ID
				}, zookeepers, {N, M});
				results.push(service);
			} else {
				const container = await runKafka({
					container_name: kafka, network, imageTag, BROKER_ID
				}, zookeepers, {N, M});
				results.push(container);
			}
		}

	}
	return results;
};
exports.down = async (swarm) => {
	const {orderer: {type}} = globalConfig;

	const toStop = true;
	await module.exports.runCAs(toStop, swarm);

	await module.exports.runPeers(undefined, toStop, swarm);
	await module.exports.runOrderers(undefined, toStop, swarm);
	if (type === 'kafka') {
		await module.exports.runKafkas(toStop, swarm);
		await module.exports.runZookeepers(toStop, swarm);
	}
	await pruneSystem(swarm);
	await networkRemove(network);
	await chaincodeClean();
	await module.exports.volumesAction(toStop);

	const nodeAppConfigJson = require('../app/config');
	fsExtra.removeSync(nodeAppConfigJson.stateDBCacheDir);
	logger.info(`[done] clear stateDBCacheDir ${nodeAppConfigJson.stateDBCacheDir}`);


	fsExtra.removeSync(MSPROOT);
	logger.info(`[done] clear MSPROOT ${MSPROOT}`);
	fsExtra.removeSync(CONFIGTX);
	logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);
};

exports.up = async (swarm) => {
	const {orderer: {type}} = globalConfig;
	await pruneSystem();
	await module.exports.volumesAction();
	await networkCreateIfNotExist({Name: network}, swarm);
	const caServices = await exports.runCAs(undefined, swarm);

	if (type === 'kafka') {
		const zkServices = await exports.runZookeepers(undefined, swarm);
		if (swarm) await tasksWaitUntilLive(zkServices);
		const kafkaServices = await exports.runKafkas(undefined, swarm);
		if (swarm) await tasksWaitUntilLive(kafkaServices);
	}
	if (swarm) await tasksWaitUntilLive(caServices);
	await require('./caCryptoGen').genAll(swarm);

	const PROFILE_BLOCK = globalConfig.orderer.genesis_block.profile;
	const configtxFile = path.resolve(__dirname, 'configtx.yaml');
	require('./configtx.js').gen({MSPROOT, PROFILE_BLOCK, configtxFile});


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


	const ordererServices = await module.exports.runOrderers(undefined, undefined, swarm);
	if (swarm) await tasksWaitUntilLive(ordererServices);

	const peerServices = await module.exports.runPeers(undefined, undefined, swarm);
	if (swarm) await tasksWaitUntilLive(peerServices);

};
