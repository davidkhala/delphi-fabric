import assert from 'assert';
import * as  helper from '../app/helper.js';
import UserBuilder from '../common/nodejs/admin/user.js';
import FabricGateway from '../common/nodejs/fabric-gateway/index.js';

describe('build', () => {
	const user = helper.getOrgAdmin(undefined, 'orderer');
	const peers = helper.newPeers([0], 'icdd');
	const peer = peers[0];
	assert.ok(!!user, 'user not found');
	const userBuilder = new UserBuilder(undefined, user);

	it('gateway', async () => {
		const gateway = new FabricGateway(peer, userBuilder);

		const contract = gateway.getContract('allchannel', 'diagnose');
	});

});
