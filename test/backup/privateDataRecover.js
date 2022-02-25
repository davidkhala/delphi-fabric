import * as helper from '../../app/helper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {stopPeer, resumePeer} from './index.js';

const logger = consoleLogger('test:backup: chaincode=master');
import {sleep} from '@davidkhala/light/index.js';

import {putPrivate, getPrivate} from '../../cc/golang/diagnose/diagnoseInvoke.js';
import '../../cc/golang/diagnose/install.js';

const flow = async () => {
	const offlineOrg = 'astri.org';
	const offlineIndex = 0;
	await stopPeer(offlineOrg, offlineIndex);
	{
		const peers = helper.newPeers([0], 'icdd');
		const clientOrg = 'astri.org';

		await putPrivate(peers, clientOrg);
	}
	await resumePeer(offlineOrg, 0);

	{
		const peers = helper.newPeers([offlineIndex], offlineOrg);
		const clientOrg = 'astri.org';

		const getPrivateLoop = async (peers, clientOrg) => {
			const [result] = await getPrivate(peers, clientOrg);
			if (!result) {
				await sleep(1000);
				logger.warn('getPrivate', 'retry');
				return getPrivateLoop(peers, clientOrg);
			} else {
				logger.info('getPrivate', result);
				return result;
			}
		};
		await getPrivateLoop(peers, clientOrg);

	}
};
flow();
