const {
	containerDelete,
} = require('../../common/docker/nodejs/dockerode-util');
const {
	runPeer
} = require('../../common/nodejs/fabric-dockerode');
const logger = require('khala-nodeutils/logger').new('tes HA');
const {sleep} = require('khala-nodeutils/helper');
const globalConfig = require('../../config/orgs');
const peerUtil = require('../../common/nodejs/peer');
const helper = require('../../app/helper');
const {CryptoPath} = require('../../common/nodejs/path');
const {installs} = require('../../app/installHelper');
const stopPeer = async (org, peerIndex) => {
	const peerName = globalConfig.orgs[org].peers[peerIndex].container_name;
	await containerDelete(peerName);
};
const {join} = require('../../common/nodejs/channel');
const resumePeer = async (org, peerIndex, TLS) => {


	const {docker: {network, fabricTag: imageTag}} = globalConfig;
	const orgsConfig = globalConfig.orgs;

	const domain = org;
	const orgConfig = orgsConfig[domain];
	const peersConfig = orgConfig.peers;


	const {mspid} = orgConfig;
	const peerConfig = peersConfig[peerIndex];
	const {container_name, port, couchDB, stateVolume} = peerConfig;


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
			id:mspid,
			volumeName: 'MSPROOT',
			configPath
		}, couchDB, stateVolume
	});


};
const resumePeerChannel = async (orgName, peerIndex, channelName) => {
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client);
	const peer = helper.newPeers([peerIndex], orgName)[0];
	await join(channel, peer);

};

const touchCC = async (org, peerIndex) => {
	const {get} = require('../../cc/master/masterInvoke');
	const peers = helper.newPeers([peerIndex], org);
	const counterKey = 'iterator';
	const result = await get(peers, org, counterKey);
	logger.debug(result);
};
const flow = async () => {
	const org = 'icdd';
	const peerIndex = 1;
	await stopPeer(org, peerIndex);
	await resumePeer(org, peerIndex, false);
	const channelName = 'allchannel';
	const chaincodeID = 'master';
	await resumePeerChannel(org, peerIndex, channelName, chaincodeID);
	await installs(chaincodeID, org, [peerIndex]);
	await sleep(30000);
	await touchCC(org, peerIndex);
};

flow();
