const config = require('./config');
const fabricDockerUtil = require('../../../common/nodejs/fabric-dockerode');
const dockerodeUtil = require('../../../common/docker/nodejs/dockerode-util');
const Request = require('request');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const pathUtil = require('../../../common/nodejs/path');
const peerUtil = require('../../../common/nodejs/peer');
const MSPROOTvolumeName = 'MSPROOT';
const CONFIGTXVolume = 'CONFIGTX';
const peerName = 'newContainer';
const peerOrg = 'NEW';
const portMap = config.orgs[peerOrg].peers[peerName].portMap;
Request.get(`${swarmBaseUrl}/config/orgs`, (err, resp, body) => {
	if (err) throw err;
	body = JSON.parse(body);
	const imageTag = `x86_64-${body.docker.fabricTag}`;
	const {network} = body.docker;
	const cryptoPath = new pathUtil.CryptoPath(peerUtil.container.MSPROOT, {
		peer: {
			name: peerName,
			org: peerOrg
		}
	});
	const promises = [
		dockerodeUtil.volumeCreateIfNotExist({Name: MSPROOTvolumeName, path: config.MSPROOT}),
		dockerodeUtil.volumeCreateIfNotExist({Name: CONFIGTXVolume, path: config.CONFIGTX})
	];
	return Promise.all(promises).then(()=>fabricDockerUtil.deployPeer({
		Name: `${peerName}.${peerOrg}`, network, imageTag,
		Constraints: config.swarm.Constraints,
		port: portMap.port, eventHubPort: portMap.eventHubPort,
		msp: {
			volumeName:MSPROOTvolumeName,
			configPath:cryptoPath.peerMSP(),
			id:config.orgs[peerOrg].MSP.id
		}, peer_hostName_full:`${peerName}.${peerOrg}`
	}));
});