import * as helper from '../../app/helper.js';
import {installAndApprove, commit, getContract} from '../testutil.js';
import assert from 'assert';

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
	const transientMap = {
		token: 'secret'
	};
	it('CreateToken', async () => {
		await contract.submit(['CreateToken', JSON.stringify({Owner: 'David'})], transientMap);
		await assert.rejects(contract.submit(['CreateToken', JSON.stringify({Owner: 'David'})], transientMap));
	});
	it('GetToken', async () => {
		const tokenData = await contract.evaluate(['GetToken'], transientMap);
		console.info(tokenData);
	});
	it('MoveToken', async () => {
		await contract.submit(['MoveToken', JSON.stringify({Owner: 'Chloe', OwnerType: 'network'})], transientMap);
	});
	it('TokenHistory', async () => {
		const history = await contract.evaluate(['TokenHistory'], transientMap);
		console.info(JSON.parse(history));

	});
	it('DeleteToken', async () => {
		await contract.submit(['DeleteToken'], transientMap);
	});

});