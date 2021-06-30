const chaincodeId = 'nodeStress';
describe('chaincode invoke', () => {
	it('touch', async () => {
		const fcn = '';
		const args = [];
		return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
	});
});


