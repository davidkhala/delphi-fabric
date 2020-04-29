const {
	get, put, cross, chaincodeID, putRaw, putBatch, whoami, getEndorsement, putEndorsement, getPage, list, getCertID, readWritePrivate, panic
} = require('../diagnoseInvoke');

const helper = require('../../../../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('invoke:diagnose');

const diagnoseInstall = require('../diagnoseInstall');
const taskKeyEndorsement = async () => {
	const org1 = 'icdd';
	const org2 = 'astri.org';
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
	const endorsingOrgs = await getEndorsement(peers, clientOrg, endorseKey);
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
	const org1 = 'icdd';
	const org2 = 'astri.org';
	const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const clientOrg = org2;
	const key = 'a';

	await putRaw(peers, clientOrg, key, 'b');
};

const taskHack = async () => {
	const org1 = 'icdd';
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

const taskPagination = async () => {
	const org1 = 'icdd';
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
	const {Bookmark} = JSON.parse(result).MetaData;
	logger.debug({Bookmark});
	result = await getPage(peers, org1, '', '', 1, Bookmark);
	logger.debug(2, result);
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

const overPaginationTest = async (peers, clientOrg, pageSize) => {

	const result = await getPage(peers, clientOrg, undefined, undefined, `${pageSize}`);
	logger.debug('pagination', result);
};
const readWritePrivateTest = async (peers, clientOrg) => {
	const key = 'a';
	const dataSet = {[key]: 'b'};
	await readWritePrivate(peers, clientOrg, dataSet);
};

const task = async (taskID = parseInt(process.env.taskID)) => {

	const peers = helper.newPeers([0], 'icdd');
	const clientOrg = 'icdd';
	switch (taskID) {
		case 1:
			await taskPagination();
			break;
		case 2:
			await taskKeyEndorsement();
			break;
		case 3:
			await taskPeerHack();
			break;
		case 4:
			await taskHack();
			break;
		case 5:
			await getCertIDTest();
			break;
		case 6:
			await worldStatesTest();
			break;
		case 7:
			await overPaginationTest(peers, clientOrg, 10);
			break;
		case 8:
			await readWritePrivateTest(helper.newPeers([0], 'astri.org'), 'astri.org');
			break;
		case 9:
			await panic(helper.newPeers([0], 'astri.org'), 'astri.org');
			break;
		default:
			await diagnoseInstall.task(process.env.channelName);
	}

};
task();
