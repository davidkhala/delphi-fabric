const install = require('../../../nodejs/diagnose/install');
const {put, get, whoami, transient, worldStates, putBatch, history, panic} = require('../invoke');
const chaincodeId = 'nodeDiagnose';
const helper = require('../../../../app/helper');
const logger = helper.getLogger(`test:${chaincodeId}`);

const task = async () => {

	const org1 = 'astri.org';
	const peers = helper.newPeers([0], org1);
	let resp;
	switch (parseInt(process.env.taskID)) {
		case -2: {
			// taskID=-2 times=101 node cc/nodejs/diagnose/test/
			const {times} = process.env;
			for (let i = 0; i < parseInt(times); i++) {
				await put(peers, org1, 'a', 'b');
			}
		}
			break;
		case -1:
			await install.task(1);
			break;
		case 0:
			await put(peers, org1, 'a', 'b');
			break;
		case 1: {
			const value = await get(peers, org1, 'a');
			logger.info('value', value);
		}
			break;
		case 2: {
			const cid = await whoami(peers, org1);
			logger.debug('CID', cid);
		}
			break;
		case 3:
			resp = await transient(peers, org1, {a: 'c'}, 'a');
			logger.debug(resp);
			break;
		case 4:
			// taskID=4 node cc/nodejs/diagnose/test/
			resp = await worldStates(peers, org1);
			logger.debug(resp);
			break;
		case 5: {
			// taskID=5 size=100 node cc/nodejs/diagnose/test/
			const {size} = process.env;
			const map = {};
			for (let i = 0; i < parseInt(size); i++) {
				const iStr = `${i}`;
				map[`key_${iStr.padStart(3, '0')}`] = iStr;
			}
			await putBatch(peers, org1, map);
		}
			break;
		case 6: {
			// taskID=6 node cc/nodejs/diagnose/test/
			resp = await history(peers, org1, 'a');
			const historyResult = JSON.parse(resp[0]);
			logger.debug(historyResult);
			logger.debug(historyResult.length);
		}
			break;
		case 7: {
			await panic(peers, org1);
		}
			break;
		default:
			await install.task(0);

	}
};

task();

