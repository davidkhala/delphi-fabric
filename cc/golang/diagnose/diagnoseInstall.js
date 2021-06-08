const InstallHelper = require('../../../nodePkg/installHelper');
const globalConfig = require('../../../config/orgs.json');
const chaincodeConfig = require('../../../config/chaincode.json');
const installHelper = new InstallHelper(globalConfig, chaincodeConfig);
const {incrementInstallAll, installs} = require('../../../app/installHelper');
const {instantiate} = require('../../../app/instantiateHelper');

const chaincodeId = 'diagnose';
const Context = require('../../../nodePkg/index');

const context = new Context(globalConfig);
const channelName = 'allchannel';
describe('golang/diagnose', () => {
	const org1 = 'astri.org';
	const org2 = 'icdd';
	it('install', async function () {
		this.timeout(30000);
		await installHelper.incrementInstallAll(chaincodeId, channelName);

	});
	it('step2', async () => {

		const p1 = context.newPeer(0, org1);
		const p2 = context.newPeer(0, org2);
		const transientMap = {
			key: 'david'
		};
		await instantiate(org1, [p1, p2], chaincodeId, 'init', [], transientMap, channelName);
	});
	it('partial install', async () => {
		await installs(chaincodeId, org1, [0]);

		const peers = context.newPeers([0], org1);
		await instantiate(org1, peers, chaincodeId);
	});
});

