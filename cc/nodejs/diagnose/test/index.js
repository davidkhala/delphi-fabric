const install = require('../../../nodejs/diagnose/install');
const {put, get, whoami, transient} = require('../invoke');
const chaincodeId = 'nodeDiagnose';
const helper = require('../../../../app/helper');
const logger = helper.getLogger(`test:${chaincodeId}`);

const task = async () => {

	const org1 = 'astri.org';
	const peers = helper.newPeers([0], org1);
	switch (parseInt(process.env.taskID)) {
		case -1:
			await install.task(1);
			break;
		case 0:
			await put(peers, org1, 'a', 'b');
			break;
		case 1:
			const value = await get(peers, org1, 'a');
			logger.info('value', value);
			break;
		case 2:
			const cid = await whoami(peers, org1);
			logger.debug('CID', cid);
			break;
		case 3:
			const resp = await transient(peers, org1, {a: 'c'}, 'a');
			logger.debug(resp);
			break;
		default:
			await install.task(0);

	}
};

task();

