const helper = require('../../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('hack: >100 history');
const {putRaw, history} = require('../../cc/golang/diagnose/diagnoseInvoke');
const install = require('../../cc/golang/diagnose/diagnoseInstall');
const taskPut = async () => {

	const peerOrg = 'icdd';
	const clientOrg = peerOrg;
	const peers = helper.newPeers([0], peerOrg);
	const key = 'key';
	await putRaw(peers, clientOrg, key, 'a');


};

const taskRepeat = async (times) => {

	// await install.task();
	for (let i = 0; i < times; i++) {
		await taskPut();
	}
	const historyRecords = await history(peers, clientOrg, key);
	logger.info('history', historyRecords[0]);
	//bad for [0] { Error: QUERY_STATE_NEXT failed: transaction ID: 8901e797ac494d64f154fd48f477c3652833416bfdaaf8409d4c6cf10b8e52c5: query iterator not found
};

taskRepeat(100);
