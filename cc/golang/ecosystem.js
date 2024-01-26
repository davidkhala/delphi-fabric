import * as helper from '../../app/helper.js';
import {installAll} from '../../app/chaincodeOperator.js';
import {installAndApprove, commit} from '../testutil.js';

const chaincodeID = 'ecosystem';
const orderers = helper.newOrderers();
const orderer = orderers[0];


describe('deploy', function () {
	this.timeout(0);
	it('install', async () => {
		await installAll(chaincodeID);
	});
	it('query installed & approve', async () => {

		const orgs = ['icdd', 'astri.org'];
		for (const org of orgs) {
			await installAndApprove(org, chaincodeID, orderer);
		}

	});
	it('commit', async () => {
		const org = 'icdd';
		await commit(org, chaincodeID, orderer);
	});
});
describe('invoke', function () {
	this.timeout(0);
	it('CreateToken', async () => {

	});
});