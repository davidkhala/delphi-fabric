const {
	get, put, cross, chaincodeID, putRaw, putBatch, whoami, getEndorsement, putEndorsement, getPage, list, getCertID
} = require('./diagnoseInvoke');
const logger = require('../../common/nodejs/logger').new('invoke:diagnose', true);
const helper = require('../../app/helper');

const DRInstall = require('./diagnoseInstall');
const taskKeyEndorsement = async () => {
	await DRInstall.task();
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	let peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const clientOrg = org2;
	const key = 'a';

	await put(peers, clientOrg, key, 'b');
	const gotValue = await get(peers, clientOrg, key);
	logger.debug('got value', gotValue);

	const cid = await whoami(peers, org1);
	logger.info({cid});
	const endorseKey = key;
	await putEndorsement(peers, org1, endorseKey, ['ASTRIMSP', 'icddMSP']);
	let endorsingOrgs = await getEndorsement(peers, clientOrg, endorseKey);
	logger.info({endorsingOrgs});
	try {
		peers = helper.newPeers([0], org1);
		await put(peers, org1, key, 'endorsing hack');
		logger.error('expect endorsing error');
	} catch (e) {
		logger.info('expect endorsing error', e);
	}
	peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	await put(peers, org1, key, 'endorsing good');
};
const taskPeerHack = async () => {
	await DRInstall.task();
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	let peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const clientOrg = org2;
	const key = 'a';

	await putRaw(peers, clientOrg, key, 'b');
};
const taskAttach = async () => {
	await DRInstall.taskAttach();
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const peers = helper.newPeers([0], org1);
	try {
		await cross(peers, org1, 'mainChain', 'put', ['a', 'avalueFromAttacker']);
	} catch (err) {
		logger.info('expected endorse error', err);
	}
	// try call an not existing chaincode
	try {
		await cross(peers, org1, 'master', 'increase');
	} catch (err) {
		logger.info('expect not exist error', err);
	}
};

const flowPagination = async () => {
	await DRInstall.task();
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const peers = helper.newPeers([0], org1);
	const map = {
		a: 'b',
		b: 'b',
		c: 'b',
		d: 'b',
		e: 'b'
	};
	await putBatch(peers, org1, map);
	const gotCCID = await chaincodeID(peers, org1);
	logger.info({gotCCID});
	let [result] = await getPage(peers, org1);// FIXME sometime there is no result
	logger.debug(1, result);
	let {Bookmark} = JSON.parse(result).MetaData;
	logger.debug({Bookmark});
	result = await getPage(peers, org1, '', '', 1, Bookmark);
	logger.debug(2, result);
};
const putBatchTest = async (size) => {
	const map = {};
	for (let i = 0; i < size; i++) {
		const iStr = `${i}`;
		const padded = iStr.padStart(3, '0');
		map[`key_${padded}`] = `${i}`;
	}
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	await putBatch(peers, org1, map);
};
const getCertIDTest = async () => {
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	const result = await getCertID(peers, org1);
	logger.info('certID', result);
};
const worldStatesTest = async () => {

	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	const result = await list(peers, org1);
	logger.debug('worldStates', result);

};
const overPaginationTest = async (pageSize) => {
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	const result = await getPage(peers, org1, undefined, undefined, `${pageSize}`);
	logger.debug('pagination', result);
};
const taskOverList = async () => {
	await DRInstall.task();
	await putBatchTest(200);
	try {
		await worldStatesTest();
	} catch (e) {
		logger.warn('worldStates failure expected');
		logger.warn(e);
	}
};
const task = async () => {
	await DRInstall.task();
	await getCertIDTest()
};
task();
