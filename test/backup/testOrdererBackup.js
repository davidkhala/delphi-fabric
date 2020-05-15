const {
	containerDelete
} = require('../../common/nodejs/admin/helper').dockerode.util;
const {
	runOrderer
} = require('../../common/nodejs/fabric-dockerode');
const {sleep, homeResolve} = require('khala-light-util');
const globalConfig = require('../../config/orgs');
const {CryptoPath} = require('../../common/nodejs/path');
const peerUtil = require('../../common/nodejs/peer');
const org = 'icdd.astri.org';
const {docker: {fabricTag, network}, orderer: {type: OrdererType}} = globalConfig;
const imageTag = `${fabricTag}`;
const targetOrderer = 'orderer2';

const {MSPROOT} = peerUtil.container;
const cryptoPath = new CryptoPath(MSPROOT, {
	orderer: {org, name: targetOrderer}
});
/**
 * @deprecated TODO until use etcdraft
 * @returns {Promise<void>}
 */
const flow = async () => {
	const ordererConfig = globalConfig.orderer.etcdraft.organizations[org];
	let {portHost, stateVolume} = ordererConfig.orderers[targetOrderer];
	stateVolume = homeResolve(stateVolume);
	const {file} = globalConfig.orderer.genesis_block;
	const container_name = cryptoPath.ordererHostName;
	await containerDelete(container_name);

	const {mspid} = ordererConfig;
	await sleep(10000);
	const configPath = cryptoPath.MSP('orderer');
	await runOrderer({
		container_name, imageTag, port: portHost, network, BLOCK_FILE: file, CONFIGTXVolume: 'CONFIGTX',
		msp: {
			id: mspid,
			configPath,
			volumeName: 'MSPROOT'
		},
		OrdererType,
		tls: false,
		stateVolume
	});
};
flow();
