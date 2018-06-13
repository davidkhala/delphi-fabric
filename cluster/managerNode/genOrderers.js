const config = require('./config');
const {deployOrderer} = require('../../common/nodejs/fabric-dockerode');
const {swarmServiceName, serviceClear, taskLiveWaiter, volumeRemove, volumeCreateIfNotExist} = require('../../common/docker/nodejs/dockerode-util');
const logger = require('../../common/nodejs/logger').new('genOrderer');
const ordererOrg = 'NewConsensus';
const ordererName = 'orderer0';
const MSPROOTvolumeName = 'MSPROOT';
const CONFIGTXvolumeName = 'CONFIGTX';
const {CryptoPath, homeResolve} = require('../../common/nodejs/path');
const peerUtil = require('../../common/nodejs/peer');
const port = config.orderer.orgs[ordererOrg].orderers[ordererName].portHost;
const {globalConfig, block, newOrg, newOrderer} = require('./swarmClient');
const path = require('path');
const asyncTask = async (action) => {
	logger.debug('[start] genOrderer');
	const Name = `${ordererName}.${ordererOrg}`;
	if (action === 'down') {
		const serviceName = swarmServiceName(Name);
		await serviceClear(serviceName);

		await volumeRemove(MSPROOTvolumeName);
		await volumeRemove(CONFIGTXvolumeName);
		logger.info('[done] down');
		return;
	}
	const CONFIGTXdir = homeResolve(config.CONFIGTX);
	const MSPROOTDir = homeResolve(config.MSPROOT);

	await volumeCreateIfNotExist({Name: MSPROOTvolumeName, path: MSPROOTDir});
	await volumeCreateIfNotExist({Name: CONFIGTXvolumeName, path: CONFIGTXdir});
	const blockFilePath = path.resolve(CONFIGTXdir, config.BLOCK_FILE);
	await block(blockFilePath);
	const {docker: {network, fabricTag}, TLS} = await globalConfig();
	const imageTag = `x86_64-${fabricTag}`;

	const id = config.orderer.orgs[ordererOrg].MSP.id;
	const cryptoPath = new CryptoPath(peerUtil.container.MSPROOT, {
		orderer: {
			name: ordererName,
			org: ordererOrg
		},
	});
	const cryptoType = 'orderer';
	const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;
	const configPath = cryptoPath.MSP(cryptoType);

	// TODO try to do channel update after orderer up
	const hostCryptoPath = new CryptoPath(MSPROOTDir, {
		orderer: {name: ordererName, org: ordererOrg},
		user: {name: 'Admin'}
	});

	const ordererService = await deployOrderer({
		Name,
		imageTag, network, port,
		msp: {
			volumeName: MSPROOTvolumeName, id,
			configPath
		}, CONFIGTXVolume: CONFIGTXvolumeName,
		BLOCK_FILE: config.BLOCK_FILE,
		kafkas: true,
		tls
	});

	await taskLiveWaiter(ordererService);
	await newOrg(hostCryptoPath, cryptoType, undefined, ordererOrg);

	const respNewOrderer = await newOrderer(hostCryptoPath.ordererHostName);
	logger.debug({respNewOrderer});

};
try {
	asyncTask(process.env.action);
} catch (err) {
	logger.error(err);
	process.exit(1);
}
