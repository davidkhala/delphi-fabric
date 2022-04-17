import InvokeHelper from '../../../app/invokeHelper.js';
import * as helper from '../../../app/helper.js';

const chaincodeId = 'nodeStress';
describe('chaincode invoke', () => {
	const org = 'icdd';
	const peers = helper.allPeers();
	const peer = peers[0]
	const {channelName} = process.env;

	it('touch', async () => {
		const invokeHelper = new InvokeHelper(peer, org, chaincodeId, channelName);
		await invokeHelper.invoke({args: []});

	});
});


