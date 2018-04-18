const Docker = require('dockerode');

const dockerUtil = require('../../common/docker/nodejs/dockerode-util');
const docker = new Docker();
const logger = require('./logger').new('dockerode');
const peerUtil = require('./peer');
const caUtil = require('./ca');

exports.runNewCA = ({
	container_name, port,network, imageTag,
}) => {

	const Image = `hyperledger/fabric-ca:${imageTag}`;

	const Cmd = ['fabric-ca-server', 'start', '-d','-b','admin:passwd'];

	const Env = caUtil.envBuilder();
	const createOptions = {
		name: container_name,
		Env,
		ExposedPorts: {
			'7054': {}
		},
		Cmd,
        Image,
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
    return dockerUtil.startContainer(createOptions);
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
exports.runNewPeer = ({
	peer: {container_name, port, eventHubPort, network, imageTag},
	msp: {
		id,  volumeName,
		configPath
	}, peer_hostName_full,
	tls
}) => {
	const Image = `hyperledger/fabric-peer:${imageTag}`;
	const Cmd = ['peer', 'node', 'start'];
	const Env = peerUtil.envBuilder({network,msp:{
		configPath,id,peer_hostName_full
	},tls});

	const createOptions = {
		name: container_name,
		Env,
		Volumes: {
			'/host/var/run/docker.sock': {},
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
				'/run/docker.sock:/host/var/run/docker.sock',
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
	return dockerUtil.startContainer(createOptions);
};
