const install = require('./install');
const {put, get, whoami} = require('./invoke');
const chaincodeId = 'nodeDiagnose';
const logger = require('../../../common/nodejs/logger').new(`test:${chaincodeId}`, true);
const helper = require('../../../app/helper');

const log = require('why-is-node-running'); // should be your first require
const task = async () => {
	await install.task();
	const org1 = 'ASTRI.org';
	const peers = helper.newPeers([0], org1);
	await put(peers, org1, 'a', 'b');
	const value = await get(peers, org1, 'a');
	logger.info('value', value);
	const cid = await whoami(peers, org1);
	logger.debug('CID', cid);
};

task().catch(err => {
	log();
});
