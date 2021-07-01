const chaincodeId = 'nodeStress';
const {invoke, query} = require('../../../app/invokeHelper');
const helper = require('../../../app/helper');
describe('chaincode invoke', () => {
	const org = 'icdd';
	const peers = helper.allPeers();
	it('touch', async () => {
		const fcn = '';
		const args = [];

		try {
			await invoke(peers, org, chaincodeId, fcn, args);
		}catch (e){
			console.error(e)
		}



	});
});


