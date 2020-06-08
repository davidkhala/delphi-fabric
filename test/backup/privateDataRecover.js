const helper = require('../../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:backup: chaincode=master');
const {stopPeer, resumePeer} = require('./index');
const {sleep} = require('../../common/nodejs/admin/helper').nodeUtil.helper();
const {putPrivate, getPrivate} = require('../../cc/golang/master/masterInvoke');
const install = require('../../cc/golang/master/masterInstall');
const flow = async () => {
	await install.task();
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
