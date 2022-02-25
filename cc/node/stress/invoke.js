import InvokeHelper from '../../../app/invokeHelper.js';
import * as helper from '../../../app/helper.js';

const chaincodeId = 'nodeStress';
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


