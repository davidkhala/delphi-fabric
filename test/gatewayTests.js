import assert from 'assert';
import * as  helper from '../app/helper.js';
import UserBuilder from '../common/nodejs/admin/user.js';
import FabricGateway from '../common/nodejs/fabric-gateway/index.js';

describe('gateway', function () {
	this.timeout(0);
	const user = helper.getOrgAdmin(undefined, 'peer');
	const peers = helper.newPeers([0], 'astri.org');
	const peer = peers[0];
	assert.ok(user, 'user not found');
	const userBuilder = new UserBuilder(undefined, user);

	const gateway = new FabricGateway(peer, userBuilder);

	it('whoami', async () => {
		const contract = gateway.getContract('allchannel', 'diagnose');
		const result = await contract.evaluateTransaction('whoami');
		console.info(result);
	});
	it('reconnect', async () => {
		gateway.disconnect();
		gateway.connect();
		const contract = gateway.getContract('allchannel', 'diagnose');
		await contract.evaluateTransaction('whoami');
	});
	it('put raw and get', async () => {
		const contract = gateway.getContract('allchannel', 'diagnose');
		await contract.submitTransaction('putRaw', 'key', 'value');

		const result = await contract.evaluateTransaction('getRaw', 'key');
		assert.strictEqual(result, 'value');
	});
	it('put private and get', async () => {
		const contract = gateway.getContract('allchannel', 'diagnose');

		const transientMap = {
			key: 'value'
		};

		await contract.submit(['putImplicit'], transientMap);
		const result = await contract.evaluate(['getImplicit'], transientMap);
		assert.strictEqual(result, `{"key":"value"}`);
	});

});
