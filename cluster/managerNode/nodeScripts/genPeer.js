const config = require('./config');
const {deployPeer, chaincodeClean} = require('../../../common/nodejs/fabric-dockerode');
const {swarmServiceName, serviceClear, taskLiveWaiter} = require('../../../common/docker/nodejs/dockerode-util');
const {CryptoPath} = require('../../../common/nodejs/path');
const peerUtil = require('../../../common/nodejs/peer');
const MSPROOTvolumeName = 'MSPROOT';
const peerName = 'newContainer';
const peerOrg = 'NEW';
const portMap = config.orgs[peerOrg].peers[peerName].portMap;
const {globalConfig} = require('./swarmClient');
const {} = require('../../../app/join-channel');
const logger = require('../../../common/nodejs/logger').new('genPeer');
const asyncTask = async () => {
	const cryptoType = 'peer';

	const cryptoPath = new CryptoPath(peerUtil.container.MSPROOT, {
		peer: {
			name: peerName,
			org: peerOrg
		}
	});
	const {peerHostName} = cryptoPath;
	const Name = `${peerName}.${peerOrg}`;
	const serviceName = swarmServiceName(Name);
	await serviceClear(serviceName);
	await chaincodeClean();
	if (process.env.action === 'down') {
		logger.info('[done] down');
		return;
	}

	const {docker: {network, fabricTag}, TLS} = await globalConfig();
	const imageTag = `x86_64-${fabricTag}`;

	//Stateful: use volume as orderer
	const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;
	const peerService = await deployPeer({
		Name, network, imageTag,
		port: portMap.port, eventHubPort: portMap.eventHubPort,
		msp: {
			volumeName: MSPROOTvolumeName,
			configPath: cryptoPath.MSP(cryptoType),
			id: config.orgs[peerOrg].MSP.id
		}, peerHostName,
		tls
	});
	await taskLiveWaiter(peerService);

};
asyncTask();