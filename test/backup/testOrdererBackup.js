const {containerDelete} = require('../../common/nodejs/helper').dockerode.util;
const {runOrderer} = require('../../common/nodejs/fabric-dockerode');
const {sleep, homeResolve} = require('khala-nodeutils/helper');
const globalConfig = require('../../config/orgs');
const {CryptoPath} = require('../../common/nodejs/path');
const peerUtil = require('../../common/nodejs/peer');
const {stopOrderer,resumeOrderer} = require('./index')
const org = 'icdd.astri.org';
const {docker: {fabricTag, network}, orderer: {type: OrdererType}} = globalConfig;
const imageTag = `${fabricTag}`;
const targetOrderer = 'orderer2';

const {MSPROOT} = peerUtil.container;
const cryptoPath = new CryptoPath(MSPROOT, {
	orderer: {org, name: targetOrderer}
});
const flow = async () => {

	await stopOrderer(org,2);
	await sleep(10000);
	await resumeOrderer(org,2);
};
flow();
// TODO
