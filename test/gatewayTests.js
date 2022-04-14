import assert from 'assert';
import * as  helper from '../app/helper.js';
import UserBuilder from '../common/nodejs/admin/user.js';
import FabricGateway from '../common/nodejs/fabric-gateway/index.js';

describe('gateway', () => {
	const user = helper.getOrgAdmin(undefined, 'peer');
	const peers = helper.newPeers([0], 'icdd');
	const peer = peers[0];
	assert.ok(user, 'user not found');
	const userBuilder = new UserBuilder(undefined, user);

	const gateway = new FabricGateway(peer, userBuilder);

	it('whoami', async () => {
		const contract = gateway.getContract('allchannel', 'diagnose');
		const result = await contract.evaluateTransaction('whoami');
		console.info(result);
		gateway.disconnect();
		await contract.evaluateTransaction('whoami');
	});
	it('reconnect', async ()=>{

		gateway.disconnect();
		gateway.connect()
		const contract = gateway.getContract('allchannel', 'diagnose');
		await contract.evaluateTransaction('whoami');
	})

});
