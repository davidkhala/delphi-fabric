const chaincodeId = 'nodeStress';
const InvokeHelper = require('../../../app/invokeHelper');

const helper = require('../../../app/helper');
describe('chaincode invoke', () => {
	const org = 'icdd';
	const peers = helper.allPeers();
	const {channelName} = process.env;

	it('touch', async () => {
		const fcn = '';
		const args = [];
		const invokeHelper = new InvokeHelper(peers, org, chaincodeId, channelName);
		await invokeHelper.invoke({fcn, args});

	});
});


