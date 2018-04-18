const DockerodeUtil = require('./util/dockerode');
const globalConfig = require('../config/orgs');

const network = globalConfig.docker.network;
const arch = 'x86_64';
const imageTag = `${arch}-${globalConfig.docker.fabricTag}`;
const volumeName = 'MSPROOT_local';
const path = require('path');
const port = 7061;
const eventHubPort = 7063;
const id = 'TkMSP';
const peerName ='peer1';
const domain = 'TK.Teeking.com';
const peerUtil = require('./util/peer');
const container_name = `${peerName}.${domain}`;
const peer_hostName_full = `${peerName}.${domain}`;
const helper = require('./helper');
const configPath = path.resolve('/etc/hyperledger/crypto-config/',
	'peerOrganizations', domain, 'peers', peer_hostName_full, 'msp');
const peersDir = path.resolve(globalConfig.docker.volumes.CACRYPTOROOT.dir,'peerOrganizations', domain, 'peers');
const opts = {
	peer: {container_name, port, eventHubPort, network, imageTag},
	msp: {id, volumeName, configPath}, peer_hostName_full
};
const caCryptoGen = require('../config/ca-crypto-gen');

const usersDir = path.resolve(globalConfig.docker.volumes.CACRYPTOROOT.dir,'peerOrganizations', domain, 'users');
caCryptoGen.genPeer('http://localhost:7054',peersDir,{peerName,domain,mspId:id},usersDir).then(()=>{
	return DockerodeUtil.runNewPeer(opts);
}).then(()=>{
	const peer = peerUtil.new({peerPort:port,peer_hostName_full});

	const channelName = 'allChannel';

	const {joinChannel} = require('./join-channel');
	const Sleep = require('sleep');
	helper.getOrgAdmin('TK').then((client) => {

		peer.peerConfig={
			eventHub :{
				port: eventHubPort,
				clientPromise: Promise.resolve(client),
			}
		};
		const channel = helper.prepareChannel(channelName, client);
		const loopJoinChannel = ()=>{
			return joinChannel(channel, [peer]).catch(err=>{
				if(err.toString().includes('Invalid results returned ::NOT_FOUND')){
					console.log('loopJoinChannel...');
					Sleep.msleep(1000);
					return loopJoinChannel();
				}
				else return Promise.reject(err);
			});
		};
		return loopJoinChannel();

	});
});

