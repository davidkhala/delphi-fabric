const Docker = require('dockerode');

const dockerUtil = require('../../common/docker/nodejs/dockerode-util');
const docker = new Docker();
const logger = require('./logger').new('dockerode');
const peerUtil = require('./peer');
const testUbuntu = () => {
	const testImage = 'ubuntu:16.04';

	dockerUtil.pullImage(testImage).then(() => {

		return docker.run(testImage, ['bash', '-c', 'uname -a'], process.stdout).then((container) => {
			console.log(container.output.StatusCode);
			return container.remove();
		}).then((data) => {
			console.log('container removed');
		}).catch((err) => {
			console.log(err);
		});
	});
};

exports.runNewCA = ({
	ca: {container_name, port, networkName}, version, arch = 'x86_64',
	config: {CAHome, containerCAHome}
}) => {

	const imageTag = `${arch}-${version}`;

	const image = `hyperledger/fabric-ca:${imageTag}`;

	const cmd = ['fabric-ca-server', 'start', '-d'];

	const Env = [`FABRIC_CA_HOME=${containerCAHome}`];
	const createOptions = {
		name: container_name,
		Env,
		Volumes: {
			[containerCAHome]: {}
		},
		ExposedPorts: {
			'7054': {}
		},
		Hostconfig: {
			Binds: [`${CAHome}:${containerCAHome}`],
			PortBindings: {
				'7054': [
					{
						'HostPort': `${port}`
					}
				]
			},
			NetworkMode: networkName
		}

	};
	return docker.run(image, cmd, undefined, createOptions);
	// tlsca.BU.Delphi.com:
	// environment:
	// 		- FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server/BU.Delphi.com/tlsca
	// container_name: BUTLSCA
	// networks:
	// 		- default
	// image: hyperledger/fabric-ca:x86_64-1.0.1
	// command: sh -c 'fabric-ca-server start -d'
	// volumes:
	// 		- /home/david/Documents/delphi-fabric/config/crypto-config/peerOrganizations/BU.Delphi.com:/etc/hyperledger/fabric-ca-server/BU.Delphi.com
	// ports:
	// 		- 7055:7054
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
	const image = `hyperledger/fabric-peer:${imageTag}`;
	const cmd = ['peer', 'node', 'start'];
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
		Cmd:cmd,
		Image:image,
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
