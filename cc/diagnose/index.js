const {get, put, cross, whoami, getEndorsement, putEndorsement} = require('./diagnoseInvoke');
const logger = require('../../common/nodejs/logger').new('invoke:diagnose', true);
const helper = require('../../app/helper');

const DRInstall = require('./diagnoseInstall');
const flow = async () => {
	await DRInstall.task();
	await DRInstall.taskAttach();
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	let peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const clientOrg = org2;
	const key = 'a';
	await put(peers, clientOrg, key, 'b');
	const gotValue = await get(peers, clientOrg, key);
	logger.debug('got value', gotValue);
	peers = helper.newPeers([0], org1);
	try {
		await cross(peers, org1, 'mainChain', 'put', ['a', 'avalueFromAttacker']);
	} catch (err) {
		logger.info('expected endorse error', err);
	}
	// try call an not existing chaincode
	try {
		await cross(peers, org1, 'master', 'increase');
	} catch (err) {
		logger.error(err);
	}
	const cid = await whoami(peers, org1);
	logger.info({cid});
	const endorseKey = key;
	await putEndorsement(peers, org1, endorseKey, [org1, org2]);
	let endorsingOrgs = await getEndorsement(peers, clientOrg, endorseKey);
	logger.info(endorsingOrgs);
	try {
		peers = helper.newPeers(0, org1);
		await put(peers, org1, key, 'endorsing hack');
		logger.error('expect endorsing error');
	} catch (e) {
		logger.info('expect endorsing error', e);
	}
};
flow();