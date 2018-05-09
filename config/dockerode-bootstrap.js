const globalConfig = require('./orgs.json');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const logger = require('../common/nodejs/logger').new('dockerode-bootstrap');
const peerUtil = require('../common/nodejs/peer');
const ordererUtil = require('../common/nodejs/orderer');
const dockerodeUtil = require('../common/nodejs/fabric-dockerode');
const channelUtil = require('../common/nodejs/channel');

const arch = 'x86_64';
const {
	containerDelete, networkRemove, volumeCreateIfNotExist,
	swarmServiceName, serviceDelete,
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
	const tls = (ORDERER_STRUCTURE) => {
		return TLS ? {
			serverKey: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'server.key'),
			serverCrt: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'server.crt'),
			caCrt: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'tls', 'ca.crt')
		} : undefined;
	};
	const toggle = ({orderer, domain, port, id}, toStop, swarm, kafka) => {
		const container_name = `${orderer}.${domain}`;
		const serviceName = swarmServiceName(container_name);
		const ORDERER_STRUCTURE = `ordererOrganizations/${domain}/orderers/${orderer}.${domain}`;

		if (toStop) {
			if (swarm) {
				return serviceDelete(serviceName);
			} else {
				return containerDelete(container_name);
			}
		} else {
			if (swarm) {
				return dockerodeUtil.deployOrderer({
					Name: container_name,
					imageTag,
					network,
					port,
					msp: {
						volumeName: MSPROOTVolume,
						configPath: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'msp'),
						id
					}, CONFIGTXVolume, BLOCK_FILE,
					kafkas: kafka,
					tls: tls(ORDERER_STRUCTURE)
				});
			} else {
				return dockerodeUtil.runOrderer({
					container_name, imageTag, port, network,
					BLOCK_FILE, CONFIGTXVolume,
					msp: {
						id,
						configPath: path.resolve(MSPROOT, ORDERER_STRUCTURE, 'msp'),
						volumeName: MSPROOTVolume
					},
					kafkas: kafka,
					tls: tls(ORDERER_STRUCTURE)
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
exports.runPeers = async (volumeName = {CONFIGTX: 'CONFIGTX', MSPROOT: 'MSPROOT'}, tostop, swarm) => {
	const imageTag = `${arch}-${fabricTag}`;
	const orgsConfig = globalConfig.orgs;
	if (!tostop) await dockerodeUtil.imagePullCCENV(imageTag);
	for (const domain in orgsConfig) {
		const orgConfig = orgsConfig[domain];
		const peersConfig = orgConfig.peers;

		const {MSP: {id}} = orgConfig;
		for (const peerIndex in peersConfig) {
			const peerConfig = peersConfig[peerIndex];
			const {container_name, portMap} = peerConfig;

			if (tostop) {
				if(swarm){
					await serviceDelete(swarmServiceName(container_name));
				}else {
					await containerDelete(container_name);
				}
				continue;
			}
			const peer_hostName_full = `peer${peerIndex}.${domain}`;
			const PEER_STRUCTURE = `peerOrganizations/${domain}/peers/${peer_hostName_full}`;


			const tls = TLS ? {
				serverKey: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'tls', 'server.key'),
				serverCrt: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'tls', 'server.crt'),
				caCrt: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'tls', 'ca.crt')
			} : undefined;

			const port = portMap.find(portEntry => portEntry.container === 7051).host;
			const eventHubPort = portMap.find(portEntry => portEntry.container === 7053).host;
			if (swarm) {
				await dockerodeUtil.deployPeer({
					Name: container_name, port, eventHubPort, imageTag, network,
					peer_hostName_full,
					msp: {
						id,
						volumeName: volumeName.MSPROOT,
						configPath: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'msp')
					},
					tls,
				});
			} else {
				await dockerodeUtil.runPeer({
					container_name, port, eventHubPort, imageTag, network,
					peer_hostName_full, tls,
					msp: {
						id,
						volumeName: volumeName.MSPROOT,
						configPath: path.resolve(peerUtil.container.MSPROOT, PEER_STRUCTURE, 'msp')
					}
				});
			}

		}

	}
};

exports.runCAs = async (toStop, swarm) => {
	const {orderer: {type}, orgs: peerOrgsConfig} = globalConfig;

	const imageTag = `${arch}-${fabricTag}`;

	const toggle = ({container_name, port}, toStop, swarm) => {
		const serviceName = swarmServiceName(container_name);

		if (toStop) {
			if (swarm) {
				return serviceDelete(serviceName);
			} else {
				return containerDelete(container_name);
			}
		} else {
			if (swarm) {
				return dockerodeUtil.deployCA({Name: container_name, network, imageTag, port});
			} else {
				return dockerodeUtil.runCA({container_name, port, network, imageTag});
			}
		}
	};
	if (type === 'kafka') {
		const promises = [];
		for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrg];
			const {portHost: port} = ordererOrgConfig.ca;
			let container_name;
			if (TLS) {
				container_name = `tlsca.${ordererOrg}`;
			} else {
				container_name = `ca.${ordererOrg}`;
			}
			promises.push(toggle({container_name, port}, toStop, swarm));
		}
		await Promise.all(promises);
	} else {
		const {ca: {portHost: port}, orgName} = globalConfig.orderer.solo;
		let container_name;
		if (TLS) {
			container_name = `tlsca.${orgName}`;
		} else {
			container_name = `ca.${orgName}`;
		}
		await toggle({container_name, port}, toStop, swarm);
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
		await toggle({container_name, port}, toStop, swarm);
	}
};

exports.runZookeepers = async (toStop, swarm) => {
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const imageTag = `${arch}-${thirdPartyTag}`;
	const allIDs = Object.values(zkConfigs).map(config => config.MY_ID);
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
				await dockerodeUtil.deployZookeeper({
					Name: zookeeper, network, imageTag, MY_ID
				}, allIDs);
			} else {
				await dockerodeUtil.runZookeeper({
					container_name: zookeeper, MY_ID, imageTag, network
				}, allIDs);
			}
		}
	}
};
exports.runKafkas = async (toStop, swarm) => {
	const kafkaConfigs = globalConfig.orderer.kafka.kafkas;
	const zkConfigs = globalConfig.orderer.kafka.zookeepers;
	const zookeepers = Object.keys(zkConfigs);
	const {N, M} = globalConfig.orderer.kafka;
	const imageTag = `${arch}-${thirdPartyTag}`;

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
				await dockerodeUtil.deployKafka({
					Name: kafka, network, imageTag, BROKER_ID
				}, zookeepers, {N, M});
			} else {
				await dockerodeUtil.runKafka({
					container_name: kafka, network, imageTag, BROKER_ID
				}, zookeepers, {N, M});
			}
		}

	}
};
exports.down = async (swarm) => {
	const {orderer: {type}} = globalConfig;

	const toStop = true;
	await module.exports.runCAs(toStop, swarm);

	await module.exports.runPeers(undefined, toStop,swarm);
	await module.exports.runOrderers(undefined, toStop,swarm);
	if (type === 'kafka') {
		await module.exports.runKafkas(toStop, swarm);
		await module.exports.runZookeepers(toStop, swarm);
	}
	await networkRemove({Name: network});

	await dockerodeUtil.chaincodeClean();
	await module.exports.volumesAction(toStop);
	await pruneSystem();

	const nodeAppConfigJson = require('../app/config');
	fsExtra.removeSync(nodeAppConfigJson.stateDBCacheDir);
	logger.info(`[done] clear stateDBCacheDir ${nodeAppConfigJson.stateDBCacheDir}`);


	const MSPROOT = globalConfig.docker.volumes.MSPROOT.dir;
	const CONFIGTX = globalConfig.docker.volumes.CONFIGTX.dir;
	fsExtra.removeSync(MSPROOT);
	logger.info(`[done] clear MSPROOT ${MSPROOT}`);
	fsExtra.removeSync(CONFIGTX);
	logger.info(`[done] clear CONFIGTX ${CONFIGTX}`);
};

exports.up = async (swarm) => {
	const {orderer: {type}} = globalConfig;
	await pruneSystem();
	await module.exports.volumesAction();
	await dockerodeUtil.networkCreateIfNotExist({Name: network}, swarm);
	await module.exports.runCAs(undefined, swarm);
	if (type === 'kafka') {
		await module.exports.runZookeepers(undefined, swarm);
		await module.exports.runKafkas(undefined, swarm);
	}
	await require('./ca-crypto-gen').genAll();

	const MSPROOT = globalConfig.docker.volumes.MSPROOT.dir;
	const CONFIGTX = globalConfig.docker.volumes.CONFIGTX.dir;
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


	await module.exports.runOrderers(undefined, undefined, swarm);
	await module.exports.runPeers(undefined, undefined, swarm);
};
