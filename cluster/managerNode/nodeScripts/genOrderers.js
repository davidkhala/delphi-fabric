const config = require('./config');
const dockerUtil = require('../../../common/nodejs/fabric-dockerode');

const Request = require('request');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const ordererOrg = 'NewConsensus';
const ordererName = 'orderer0';
const MSPROOTvolumeName = 'MSPROOT';
const CONFIGTXVolume = 'CONFIGTX';
const pathUtil = require('../../../common/nodejs/path');
const peerUtil = require('../../../common/nodejs/peer');
const port = config.orderer.orgs[ordererOrg].orderers[ordererName].portHost;

Request.get(`${swarmBaseUrl}/config/orgs`, async (err, resp, body) => {
	if (err) throw err;
	body = JSON.parse(body);
	const imageTag = `x86_64-${body.docker.fabricTag}`;
	const {network} = body.docker;

	const promises = [
		dockerUtil.volumeReCreate({Name: MSPROOTvolumeName, path: config.MSPROOT}),
		dockerUtil.volumeReCreate({Name: CONFIGTXVolume, path: config.CONFIGTX})
	];
	const id = config.orderer.orgs[ordererOrg].MSP.id;
	// {Name, network, imageTag, Constraints, port, msp: {volumeName, configPath, id}, CONFIGTXVolume, BLOCK_FILE, kafkas, tls}
	const cryptoPath = new pathUtil.CryptoPath(peerUtil.container.MSPROOT, {
		orderer: {
			name: ordererName,
			org: ordererOrg
		}
	});
	await Promise.all(promises);
	await dockerUtil.deployOrderer({
		Name: `${ordererName}.${ordererOrg}`,
		imageTag, network, port,
		Constraints: config.swarm.Constraints,
		msp: {
			volumeName: MSPROOTvolumeName, id,
			configPath: cryptoPath.ordererMSP()
		}, CONFIGTXVolume,
		BLOCK_FILE: config.BLOCK_FILE,
		kafkas: true
	});
});