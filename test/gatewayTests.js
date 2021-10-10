const helper = require('../app/helper');
const UserBuilder = require('../common/nodejs/admin/user');
const FabricGateway = require('../common/nodejs/fabric-gateway');

const assert = require('assert');
const logger = require('khala-logger/log4js').consoleLogger('fabric-gateway');

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
