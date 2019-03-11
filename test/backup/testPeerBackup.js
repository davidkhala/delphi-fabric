const {
	containerDelete
} = require('../../common/docker/nodejs/dockerode-util');
const {
	runPeer
} = require('../../common/nodejs/fabric-dockerode');
const {nodeUtil} = require('../../common/nodejs/helper');
const logger = nodeUtil.devLogger('test:peer HA');
const {sleep, homeResolve} = nodeUtil.helper();
const globalConfig = require('../../config/orgs');
const {TLS} = globalConfig;
const peerUtil = require('../../common/nodejs/peer');
const helper = require('../../app/helper');
const {CryptoPath} = require('../../common/nodejs/path');
const {installs} = require('../../app/installHelper');
const stopPeer = async (org, peerIndex) => {
	const peerName = globalConfig.orgs[org].peers[peerIndex].container_name;
	await containerDelete(peerName);
};
const {join} = require('../../common/nodejs/channel');
const resumePeer = async (org, peerIndex) => {


	const {docker: {network, fabricTag: imageTag}} = globalConfig;
	const orgsConfig = globalConfig.orgs;

	const domain = org;
	const orgConfig = orgsConfig[domain];
	const peersConfig = orgConfig.peers;


	const {mspid} = orgConfig;
	const peerConfig = peersConfig[peerIndex];
	const {container_name, port, couchDB} = peerConfig;

	let {stateVolume} = peerConfig;
	if (stateVolume) {
		stateVolume = homeResolve(stateVolume);
	}

	const cryptoPath = new CryptoPath(peerUtil.container.MSPROOT, {
		peer: {
			org: domain, name: `peer${peerIndex}`
		}
	});
	const {peerHostName} = cryptoPath;

	const cryptoType = 'peer';
	const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;

	const type = 'peer';
	const configPath = cryptoPath.MSP(type);

	await runPeer({
		container_name, port, imageTag, network,
		peerHostName, tls,
		msp: {
			id: mspid,
			volumeName: 'MSPROOT',
			configPath
		}, couchDB, stateVolume
	});


};
const resumePeerChannel = async (orgName, peerIndex, channelName) => {
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client);
	const peer = helper.newPeer(peerIndex, orgName);
	await join(channel, peer);

};

const touchCC = async (org, peerIndex) => {
	const {get} = require('../../cc/master/masterInvoke');
	const peer = helper.newPeer(peerIndex, org);
	const counterKey = 'iterator';
	const result = await get([peer], org, counterKey);
	logger.debug(result);
};
const flowStopPeers = async () => {
	await stopPeer('icdd', 0);
	await stopPeer('icdd', 1);
	await stopPeer('ASTRI.org', 0);
	await stopPeer('ASTRI.org', 1);
};
const flowResumePeers = async () => {
	await resumePeer('icdd', 0);// anchor peers should resume first
	await resumePeer('ASTRI.org', 0);// anchor peers should resume first
};
const flow = async () => {
	const org = 'icdd';
	const peerIndex = 1;
	await stopPeer(org, peerIndex);
	await resumePeer(org, peerIndex);
	const channelName = 'allchannel';
	const chaincodeID = 'master';
	await resumePeerChannel(org, peerIndex, channelName, chaincodeID);
	await installs(chaincodeID, org, [peerIndex]);
	await sleep(30000);
	await touchCC(org, peerIndex);
};
const flow2 = async () => {
	await touchCC('icdd', 0);
	await flowStopPeers();
	await flowResumePeers();
	await touchCC('icdd', 0);
};
flow2();
