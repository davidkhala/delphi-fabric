import * as helper from '../../app/helper.js';
import {installAndApprove, commit, getContract} from '../testutil.js';

const chaincodeID = 'ecosystem';
const orderers = helper.newOrderers();
const orderer = orderers[0];


describe('deploy', function () {
	this.timeout(0);
	it('install & approve', async () => {

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
	const contract = getContract(chaincodeID);
	it('CreateToken', async () => {
		try {
			await contract.submitTransaction('CreateToken', JSON.stringify({Owner: 'icddMSP', MintTime: new Date()}));
		} catch (e) {
			console.error(e);
		}


	});
});