const {containerDelete} = require('../../common/nodejs/helper').dockerode.util;
const {runPeer, runOrderer} = require('../../common/nodejs/fabric-dockerode');
const {helper: {homeResolve}} = require('../../common/nodejs/helper').nodeUtil;
const globalConfig = require('../../config/orgs');
const {TLS} = globalConfig;
const peerUtil = require('../../common/nodejs/peer');
const {CryptoPath} = require('../../common/nodejs/path');
const {docker: {network, fabricTag: imageTag}} = globalConfig;
const CONFIGTXVolume = 'CONFIGTX';
exports.stopPeer = async (org, peerIndex) => {
	const peerName = globalConfig.orgs[org].peers[peerIndex].container_name;
	await containerDelete(peerName);
};
const getOrdererContainerName = (org, index) => {
	const {type} = globalConfig.orderer;
	if (type === 'solo') {
		return globalConfig.orderer.solo.container_name;
	} else {
		return `orderer${index}.${org}`;
	}
};
exports.stopOrderer = async (org, index) => { // TODO
	await containerDelete(getOrdererContainerName(org, index));
};
exports.resumeOrderer = async (org, index) => { // TODO
	const container_name = getOrdererContainerName(org, index);
	const {type} = globalConfig.orderer;
	let ordererConfig;
	if (type === 'solo') {
		ordererConfig = globalConfig.orderer.solo;
	} else {
		ordererConfig = globalConfig.orderer[type].orgs[org].orderers[`orderer${index}`];
	}
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
		msp: {id, configPath, volumeName: 'MSPROOT'}, OrdererType: type, tls, stateVolume
	});
};
exports.resumePeer = async (org, peerIndex) => {

	const orgsConfig = globalConfig.orgs;
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
