const InstallHelper = require('../../../nodePkg/installHelper');
const globalConfig = require('../../../config/orgs.json');
const chaincodeConfig = require('../../../config/chaincode.json');
const BinManager = require('khala-fabric-sdk-node/binManager');
process.env.binPath = require('path').resolve(__dirname, '../../../common/bin');
const binManager = new BinManager();
const installHelper = new InstallHelper(globalConfig, chaincodeConfig, binManager);
const ChaincodeHelper = require('../../../nodePkg/chaincodeHelper');
const chaincodeHelper = new ChaincodeHelper(chaincodeConfig);

const chaincodeId = 'stress';
const Context = require('../../../nodePkg/index');

const context = new Context(globalConfig);
const channelName = 'allchannel';
describe('golang/stress', () => {
	const org1 = 'astri.org';
	const org2 = 'icdd';
	it('install', async function () {
		this.timeout(30000);
		try {
			await installHelper.installAll(chaincodeId, channelName);
		} catch (e) {
			console.error(e);
			throw e;
		}


	});
	it('instantiate', async function () {
		this.timeout(30000);
		const p1 = context.newPeer(0, org1);
		const p2 = context.newPeer(0, org2);

		const client = context.getOrgAdmin(org1);
		const channel = context.prepareChannel(channelName, client);
		const orderer = context.newOrderers()[0];

		await chaincodeHelper.upgrade(channel, [p1, p2], {args: [], chaincodeId}, orderer);


	});

});

