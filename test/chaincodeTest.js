//TODO WIP
const assert = require('assert');
const {approve, install} = require('../common/nodejs/chaincodeOperation');
const helper = require('../app/helper');
let orderer, user, peers, PackageID;
const channelName = 'allchannel';
const chaincodeID = 'diagnose';
const LifecycleProposal = require('../common/nodejs/admin/lifecycleProposal')
describe(`chaincode:${chaincodeID}`, () => {

	before(() => {
		orderer = helper.newOrderers()[0];
	});
	beforeEach(() => {
		const org = helper.randomOrg('peer');
		peers = helper.newPeer([0, 1], org);
	});

	describe('query install', () => {
		it('package', async () => {
			new LifecycleProposal()
		});
	});
	describe('approve', () => {

		it('approve 1', async () => {
			await approve(peers, {name, version, PackageID}, channelName, user, orderer);
		});


	});

	describe('error', () => {
		it('should return an error', () => {
			assert.throws(() => {
				throw Error('abc');
			}, {
				message: 'abc'
			});
		});
	});
});