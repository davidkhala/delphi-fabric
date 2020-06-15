const QueryHub = require('../../common/nodejs/query');
const helper = require('../../app/helper');
const {uninstallChaincode} = require('../../common/nodejs/fabric-dockerode');
const logger = require('khala-logger/log4js').consoleLogger('test:uninstall');
const {sleep} = require('khala-light-util');
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
		this.timeout(30000);
		const containerName = 'peer0.icdd';
		const installed = await queryHub.chaincodesInstalled();
		const packageId = Object.keys(installed[0])[0];
		await uninstallChaincode(containerName, packageId);
		await sleep(2000);
		const updatedInstalled = await queryHub.chaincodesInstalled();
		logger.info(updatedInstalled[0]);
	});

});
