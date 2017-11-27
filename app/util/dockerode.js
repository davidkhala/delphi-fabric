const Docker = require('dockerode')

const dockerUtil = require('../../common/docker/nodejs/dockerode-util')
const docker = new Docker()
const logger = require('./logger').new('dockerode')
const testUbuntu = () => {
	const testImage = 'ubuntu:16.04'

	dockerUtil.pullImage(testImage).then(() => {

		return docker.run(testImage, ['bash', '-c', 'uname -a'], process.stdout).then((container) => {
			console.log(container.output.StatusCode)
			return container.remove()
		}).then(function(data) {
			console.log('container removed')
		}).catch(function(err) {
			console.log(err)
		})
	})
}

exports.runNewCA = ({
											ca: { containerName, port, networkName }, version, arch = 'x86_64',
											config: { CAHome, containerCAHome }
										}) => {

	const imageTag = `${arch}-${version}`

	const image = `hyperledger/fabric-ca:${imageTag}`

	const cmd = ['fabric-ca-server', 'start', '-d']

	const Env = [`FABRIC_CA_HOME=${containerCAHome}`]
	const createOptions = {
		name: containerName,
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

	}
	return docker.run(image, cmd, undefined, createOptions)
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
}
exports.uninstallChaincode = ({ containerName, chaincodeId, chaincodeVersion }) => {
	const container = docker.getContainer(containerName)
	const options = {
		Cmd: ['rm', '-rf', `/var/hyperledger/production/chaincodes/${chaincodeId}.${chaincodeVersion}`]
	}

	return container.exec(options).then(exec =>
			exec.start().then(() => exec.inspect())
	)

// 	docker exec $PEER_CONTAINER rm -rf /var/hyperledger/production/chaincodes/$CHAINCODE_NAME.$VERSION
}
//TODO for testNewOrgs
const runNewPeer = ({
											peer: { containerName, port, eventHubPort, networkName }, version, arch = 'x86_64',
											msp: { id, configPath, containerConfigPath }, domain,
											tls
										}) => {
	const imageTag = `${arch}-${version}`

	const tlsParams = tls ? [
		`CORE_PEER_TLS_KEY_FILE=${tls.serverKey}`,
		`CORE_PEER_TLS_CERT_FILE=${tls.serverCrt}`,
		`CORE_PEER_TLS_ROOTCERT_FILE=${tls.caCrt}`] : []

	const image = `hyperledger/fabric-peer:${imageTag}`
	const cmd = ['peer', 'node', 'start']
	const Env = [
		'CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock',
		'CORE_LOGGING_LEVEL=DEBUG',
		'CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true',
		`CORE_PEER_GOSSIP_EXTERNALENDPOINT=${containerName}:7051`,
		`CORE_PEER_LOCALMSPID=${id}`,
		`CORE_PEER_MSPCONFIGPATH=${containerConfigPath}`,
		`CORE_PEER_ID=${domain}`,
		`CORE_PEER_ADDRESS=${domain}:7051`].concat(tlsParams)

	const createOptions = {
		name: containerName,
		Env,
		Volumes: {
			'/host/var/run/docker.sock': {},
			[containerConfigPath]: {}
		},
		ExposedPorts: {
			'7051': {},
			'7053': {}
		},
		Hostconfig: {
			Binds: [
				'/run/docker.sock:/host/var/run/docker.sock',
				`${configPath}:${containerConfigPath}`],
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
			NetworkMode: networkName
		}
	}
	return docker.run(image, cmd, undefined, createOptions).then((err, data, container) => {
		console.log(data.StatusCode)
	})
}

// docker run -d --name $peerContainerName \
// 		-e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
// -e CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=$dockerNetworkName \
// 		-e CORE_LOGGING_LEVEL=DEBUG \
// 		-e CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true \
// 		-e CORE_PEER_GOSSIP_USELEADERELECTION=false \
// 		-e CORE_PEER_GOSSIP_ORGLEADER=true \
// 		-e CORE_PEER_GOSSIP_EXTERNALENDPOINT=$peerContainerName:7051 \
// 		-e CORE_PEER_LOCALMSPID=$MSPID \
// 		-e CORE_PEER_MSPCONFIGPATH=$CRYPTO_CONFIG_CONTAINER_DIR/peerOrganizations/$org_domain/peers/$peerDomainName/msp \
// 		-e CORE_PEER_TLS_ENABLED=$TLS_ENABLED \
// 		$TLS_ENV \
// 		-e CORE_PEER_ID=$peerDomainName \
// 		-e CORE_PEER_ADDRESS=$peerDomainName:7051 \
// 		-p $peerPort:7051 \
// 		-p $eventHubPort:7053 \
// 		--volume /run/docker.sock:/host/var/run/docker.sock \
// 		--volume $CRYPTO_CONFIG_DIR:$CRYPTO_CONFIG_CONTAINER_DIR \
// 		$image $CMD