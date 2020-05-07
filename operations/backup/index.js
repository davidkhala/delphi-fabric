const {containerDelete} = require('khala-dockerode/dockerode-util');
const {runPeer, runOrderer} = require('../../common/nodejs/fabric-dockerode');
const {homeResolve} = require('khala-nodeutils/helper');
const globalConfig = require('../../config/orgs');
const {TLS} = globalConfig;
const peerUtil = require('../../common/nodejs/peer');
const {CryptoPath} = require('../../common/nodejs/path');
const {docker: {network, fabricTag: imageTag}} = globalConfig;
const CONFIGTXVolume = 'CONFIGTX';
exports.stopPeer = async (org, peerIndex) => {
	const peerName = globalConfig.organizations[org].peers[peerIndex].container_name;
	await containerDelete(peerName);
};
const getOrdererContainerName = (org, index) => {
	return `orderer${index}.${org}`;
};
exports.stopOrderer = async (org, index) => {
	await containerDelete(getOrdererContainerName(org, index));
};
exports.resumeOrderer = async (org, index) => {
	const container_name = getOrdererContainerName(org, index);
	const {type} = globalConfig.orderer;

	const ordererConfig = globalConfig.orderer[type].organizations[org].orderers[`orderer${index}`];
	const {portHost, mspid: id} = ordererConfig;
	const stateVolume = homeResolve(ordererConfig.stateVolume);
	const cryptoPath = new CryptoPath(peerUtil.container.MSPROOT, {
		orderer: {org, name: `orderer${index}`}
	});
	const tls = TLS ? cryptoPath.TLSFile('orderer') : undefined;
	const {file: BLOCK_FILE} = globalConfig.orderer.genesis_block;
	const configPath = cryptoPath.MSP('orderer');

	await runOrderer({
		container_name, imageTag, port: portHost, network, BLOCK_FILE, CONFIGTXVolume,
		msp: {id, configPath, volumeName: 'MSPROOT'}, ordererType: type, tls, stateVolume
	});
};
exports.resumePeer = async (org, peerIndex) => {
	const orgsConfig = globalConfig.organizations;
	const orgConfig = orgsConfig[org];
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
			org, name: `peer${peerIndex}`
		}
	});
	const {peerHostName} = cryptoPath;
	const nodeType = 'peer';
	const tls = TLS ? cryptoPath.TLSFile(nodeType) : undefined;
	const configPath = cryptoPath.MSP(nodeType);

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

