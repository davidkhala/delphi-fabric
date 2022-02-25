import QueryHub from '../../common/nodejs/query.js';
import * as helper from '../../app/helper.js';
import {uninstallChaincode} from '../../common/nodejs/fabric-dockerode';
import {sleep} from '@davidkhala/light/index.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';

const logger = consoleLogger('test:uninstall');

describe('uninstall lifecycle chaincode', () => {
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	const admin = helper.getOrgAdmin(org1);
	const queryHub = new QueryHub(peers, admin);
	before(async () => {
		for (const peer of peers) {
			await peer.connect();
		}
	});
	it('uninstall diagnose', async function () {
		this.timeout(0);
		const containerName = 'peer0.icdd';
		const installed = await queryHub.chaincodesInstalled();
		const packageId = Object.keys(installed[0])[0];
		logger.info('before uninstall', installed[0]);
		await uninstallChaincode(containerName, packageId);
		await sleep(1000);
		const updatedInstalled = await queryHub.chaincodesInstalled();
		logger.info(updatedInstalled[0]);
	});

});
