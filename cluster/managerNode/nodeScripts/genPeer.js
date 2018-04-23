const config = require('./config');
const dockerUtil = require('../../../app/util/dockerode');

const Request = require('request');
const swarmServerConfig = require('../../../swarm/swarm');
const swarmBaseUrl = `${swarmServerConfig.swarmServer.url}:${swarmServerConfig.swarmServer.port}`;
const pathUtil = require('../../../app/util/path');
const peerUtil = require('../../../app/util/peer');
const MSPROOTvolumeName = 'MSPROOT';
const CONFIGTXVolume = 'CONFIGTX';
const peerName = 'newContainer';
const peerOrg = 'NEW';
const portMap = config.orgs.NEW.peers.newContainer.portMap;
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
		dockerUtil.volumeCreateIfNotExist({Name: MSPROOTvolumeName, path: config.MSPROOT}),
		dockerUtil.volumeCreateIfNotExist({Name: CONFIGTXVolume, path: config.CONFIGTX})
	];
	return Promise.all(promises).then(()=>dockerUtil.deployNewPeer({
        Name: `${peerName}.${peerOrg}`, network, imageTag,
		Constraints: config.swarm.Constraints,
		port: portMap.port, eventHubPort: portMap.eventHubPort,
		msp: {
			volumeName:MSPROOTvolumeName,
			configPath:cryptoPath.peerMSP(),
			id:config.orgs.NEW.MSP.id
		}, peer_hostName_full:`${peerName}.${peerOrg}`
	}));
});