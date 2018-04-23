const Docker = require('dockerode');

const dockerUtil = require('../../common/docker/nodejs/dockerode-util');
const docker = new Docker();
const logger = require('./logger').new('dockerode');
const peerUtil = require('./peer');
const caUtil = require('./ca');
const ordererUtil = require('./orderer');

exports.runNewCA = ({
	container_name, port, network, imageTag,
}) => {
	const createOptions = {
		name: container_name,
		Env: caUtil.envBuilder(),
		ExposedPorts: {
			'7054': {}
		},
		Cmd: ['fabric-ca-server', 'start', '-d', '-b', 'admin:passwd'],
		Image: `hyperledger/fabric-ca:${imageTag}`,
		Hostconfig: {
			PortBindings: {
				'7054': [
					{
						'HostPort': `${port}`
					}
				]
			},
			NetworkMode: network
		}
	};
	return dockerUtil.containerStart(createOptions);
};
exports.deployNewCA = ({Name, network, imageTag, Constraints, port}) => {
	return dockerUtil.serviceExist({Name}).then((info) => {
		if (info) return info;
		return dockerUtil.serviceCreate({
			Image: `hyperledger/fabric-ca:${imageTag}`,
			Name,
			Cmd: ['fabric-ca-server', 'start', '-d', '-b', 'admin:passwd'],
			network, Constraints, volumes: [], ports: [{host: port, container: 7054}]
		});
	});
};


exports.uninstallChaincode = ({container_name, chaincodeId, chaincodeVersion}) => {
	const container = docker.getContainer(container_name);
	const options = {
		Cmd: ['rm', '-rf', `/var/hyperledger/production/chaincodes/${chaincodeId}.${chaincodeVersion}`]
	};

	return container.exec(options).then(exec =>
		exec.start().then(() => exec.inspect())
	);

// 	docker exec $PEER_CONTAINER rm -rf /var/hyperledger/production/chaincodes/$CHAINCODE_NAME.$VERSION
};
exports.runNewOrderer = ({container_name, imageTag, port, network, BLOCK_FILE, CONFIGTXVolume, msp: {id, configPath, volumeName}, kafkas, tls}) => {
	const Image = `hyperledger/fabric-orderer:${imageTag}`;
	const Cmd = ['orderer'];
	const Env = ordererUtil.envBuilder({
		BLOCK_FILE, msp: {
			configPath, id
		}, kafkas, tls
	});

	const createOptions = {
		name: container_name,
		Env,
		Volumes: {
			[peerUtil.container.MSPROOT]: {},
			[ordererUtil.container.CONFIGTX]: {},
		},
		Cmd,
		Image,
		ExposedPorts: {
			'7050': {},
		},
		Hostconfig: {
			Binds: [
				`${volumeName}:${peerUtil.container.MSPROOT}`,
				`${CONFIGTXVolume}:${ordererUtil.container.CONFIGTX}`
			],
			PortBindings: {
				'7050': [
					{
						'HostPort': `${port}`
					}
				]
			},
			NetworkMode: network
		}
	};
	return dockerUtil.containerStart(createOptions);
};

exports.deployNewOrderer = ({
	Name, network, imageTag, Constraints, port,
	msp: {volumeName, configPath, id}, CONFIGTXVolume, BLOCK_FILE, kafkas, tls
}) => {
	return dockerUtil.serviceExist({Name}).then((info) => {
		if (info) return info;
		const Env = ordererUtil.envBuilder({BLOCK_FILE, msp: {configPath, id}, kafkas, tls});
		return dockerUtil.serviceCreate({
			Cmd: ['orderer'],
			Image: `hyperledger/fabric-orderer:${imageTag}`
			, Name, network, Constraints, volumes: [{
				volumeName, volume: peerUtil.container.MSPROOT
			}, {
				volumeName: CONFIGTXVolume, volume: ordererUtil.container.CONFIGTX
			}], ports: [{host: port, container: 7050}],
			Env
		});
	});
};
exports.deployNewPeer = ({
	Name, network, imageTag, Constraints, port, eventHubPort,
	msp: {volumeName, configPath, id}, peer_hostName_full, tls
}) => {
	return dockerUtil.serviceExist({Name}).then((info) => {
		if (info) return info;
		const Env = peerUtil.envBuilder({
			network, msp: {
				configPath, id, peer_hostName_full
			}, tls
		});

		return dockerUtil.serviceCreate({
			Image: `hyperledger/fabric-peer:${imageTag}`,
			Cmd: ['peer', 'node', 'start'],
			Name, network, Constraints, volumes: [{
				volumeName, volume: peerUtil.container.MSPROOT
			}, {
				Type:'bind',volumeName: peerUtil.host.dockerSock, volume: peerUtil.container.dockerSock
			}], ports: [
				{host: port, container: 7051},
				{host: eventHubPort, container: 7053}
			],
			Env
		});
	});
};
exports.runNewPeer = ({
	container_name, port, eventHubPort, network, imageTag,
	msp: {
		id, volumeName,
		configPath
	}, peer_hostName_full, tls
}) => {
	const Image = `hyperledger/fabric-peer:${imageTag}`;
	const Cmd = ['peer', 'node', 'start'];
	const Env = peerUtil.envBuilder({
		network, msp: {
			configPath, id, peer_hostName_full
		}, tls
	});

	const createOptions = {
		name: container_name,
		Env,
		Volumes: {
			[peerUtil.container.dockerSock]: {},
			[peerUtil.container.MSPROOT]: {}
		},
		Cmd,
		Image,
		ExposedPorts: {
			'7051': {},
			'7053': {}
		},
		Hostconfig: {
			Binds: [
				`${peerUtil.host.dockerSock}:${peerUtil.container.dockerSock}`,
				`${volumeName}:${peerUtil.container.MSPROOT}`],
			PortBindings: {
				'7051': [
					{
						'HostPort': `${port}`
					}
				],
				'7053': [
					{
						'HostPort': `${eventHubPort}`
					}
				]
			},
			NetworkMode: network
		}
	};
	return dockerUtil.containerStart(createOptions);
};

exports.volumeReCreate = ({Name, path}) => {
	return dockerUtil.volumeRemove({Name}).then(() => dockerUtil.volumeCreateIfNotExist({Name, path}));
};
exports.volumeCreateIfNotExist = ({Name, path}) => {
	return dockerUtil.volumeCreateIfNotExist({Name, path});
};
/**
 * service=<service name>
 node=<node id or name>
 */
exports.findTask = ({service, node, state}) => {
	return dockerUtil.taskList({
		services: service ? [service] : [],
		nodes: node ? [node] : [],
	}).then(result => {
		if (state) {
			return result.filter((each) => {
				return each.Status.State = state;
			});
		} else {
			return result;
		}
	});
};