const {
	containerDelete
} = require('../../common/nodejs/helper').dockerode.util;
const {
	runPeer
} = require('../../common/nodejs/fabric-dockerode');
const {helper: {homeResolve}} = require('../../common/nodejs/helper').nodeUtil;
const globalConfig = require('../../config/orgs');
const {TLS} = globalConfig;
const peerUtil = require('../../common/nodejs/peer');
const {CryptoPath} = require('../../common/nodejs/path');
exports.stopPeer = async (org, peerIndex) => {
	const peerName = globalConfig.orgs[org].peers[peerIndex].container_name;
	await containerDelete(peerName);
};
exports.resumePeer = async (org, peerIndex) => {


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
