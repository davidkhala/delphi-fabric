const config = require('./config');
const fabricDocker = require('../../../common/nodejs/fabric-dockerode');
const dockerUtil = require('../../../common/docker/nodejs/dockerode-util');
const ordererOrg = 'NewConsensus';
const ordererName = 'orderer0';
const MSPROOTvolumeName = 'MSPROOT';
const CONFIGTXVolume = 'CONFIGTX';
const {CryptoPath, homeResolve} = require('../../../common/nodejs/path');
const peerUtil = require('../../../common/nodejs/peer');
const port = config.orderer.orgs[ordererOrg].orderers[ordererName].portHost;
const {globalConfig,block} = require('./swarmClient');
const path = require('path');

const asyncTask = async () => {
	const {docker: {network, fabricTag}, TLS}  = await globalConfig;
	const CONFIGTXdir = homeResolve(config.CONFIGTX);
	const blockFilePath =path.resolve(CONFIGTXdir,config.BLOCK_FILE);
	await block(blockFilePath);
	const imageTag = `x86_64-${fabricTag}`;

	const Name = `${ordererName}.${ordererOrg}`;
	const serviceName = dockerUtil.swarmServiceName(Name);
	await dockerUtil.serviceClear(serviceName);
	const promises = [
		fabricDocker.volumeReCreate({Name: MSPROOTvolumeName, path: homeResolve(config.MSPROOT)}),
		fabricDocker.volumeReCreate({Name: CONFIGTXVolume, path: CONFIGTXdir})
	];
	const id = config.orderer.orgs[ordererOrg].MSP.id;
	const cryptoPath = new CryptoPath(peerUtil.container.MSPROOT, {
		orderer: {
			name: ordererName,
			org: ordererOrg
		}
	});
	const cryptoType = 'orderer';
	await Promise.all(promises);
	const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;
	const configPath = cryptoPath.MSP(cryptoType);

	const ordererService = await fabricDocker.deployOrderer({
		Name,
		imageTag, network, port,
		msp: {
			volumeName: MSPROOTvolumeName, id,
			configPath
		}, CONFIGTXVolume,
		BLOCK_FILE: config.BLOCK_FILE,
		kafkas: true,
		tls
	});

	await dockerUtil.tasksWaitUntilLive([ordererService]);

};
asyncTask();