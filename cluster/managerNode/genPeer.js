const config = require('./config');
const {deployPeer, chaincodeClean} = require('../../common/nodejs/fabric-dockerode');
const {swarmServiceName, serviceClear, taskLiveWaiter} = require('../../common/docker/nodejs/dockerode-util');
const {CryptoPath, homeResolve} = require('../../common/nodejs/path');
const peerUtil = require('../../common/nodejs/peer');
const {adminName, loadFromLocal} = require('../../common/nodejs/user');
const {globalConfig} = require('./swarmClient');
const {join:joinChannel} = require('../../common/nodejs/channel');
const logger = require('../../common/nodejs/logger').new('genPeer');
const {newOrg} = require('./swarmClient');
const channelUtil = require('../../common/nodejs/channel');
const clientUtil = require('../../common/nodejs/client');
const eventHubUtil = require('../../common/nodejs/eventHub');
const MSPROOTvolumeName = 'MSPROOT';
const peerName = 'newContainer';
const peerOrg = 'NEW';
const portMap = config.orgs[peerOrg].peers[peerName].portMap;
const ordererUtil = require('../../common/nodejs/orderer');
const asyncTask = async (action) => {
	logger.debug('[start] genPeer');
	const cryptoType = 'peer';
	const channelName = 'allchannel';

	const cryptoPath = new CryptoPath(peerUtil.container.MSPROOT, {
		peer: {
			name: peerName,
			org: peerOrg
		},
		user: {
			name: adminName
		}
	});
	const hostCryptoPath = new CryptoPath(homeResolve(config.MSPROOT), {
		peer: {
			name: peerName,
			org: peerOrg
		},
		user: {
			name: adminName
		}
	});
	const {peerHostName} = cryptoPath;
	if (action === 'down') {
		const serviceName = swarmServiceName(peerHostName);
		await serviceClear(serviceName);
		await chaincodeClean();
		logger.info('[done] down');
		return;
	}

	await newOrg(hostCryptoPath, cryptoType, channelName, peerOrg);

	const {docker: {network, fabricTag}, TLS} = await globalConfig();
	const imageTag = `x86_64-${fabricTag}`;

	//Stateful: use volume created in  genOrderer
	const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;
	const peerPort = portMap.port;
	const eventHubPort = portMap.eventHubPort;
	const peerService = await deployPeer({
		Name: peerHostName, network, imageTag,
		port: peerPort, eventHubPort,
		msp: {
			volumeName: MSPROOTvolumeName,
			configPath: cryptoPath.MSP(cryptoType),
			id: config.orgs[peerOrg].MSP.id
		}, peerHostName,
		tls
	});
	await taskLiveWaiter(peerService);

	const peerClient = clientUtil.new();
	const peerAdmin = await loadFromLocal(hostCryptoPath, 'peer', config.orgs[peerOrg].MSP.id, peerClient.getCryptoSuite());
	await peerClient.setUserContext(peerAdmin, true);


	const channel = channelUtil.new(peerClient, channelName);
	const {caCert: cert} = TLS ? hostCryptoPath.TLSFile(cryptoType) : {};
	const peer = peerUtil.new({peerPort, peerHostName, cert});
	const eventHub = eventHubUtil.new(peerClient, {eventHubPort, cert, peerHostName});
	const Orderer = ordererUtil.new({ordererPort: 8050});//FIXME Testing with tls disabled, we cannot join channel without orderer pem
	await joinChannel(channel, peer, eventHub, Orderer);
};
try {
	asyncTask(process.env.action);
} catch (err) {
	logger.error(err);
	process.exit(1);
}
