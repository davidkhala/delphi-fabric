import assert from 'assert';
import {findOrgName} from '../app/helper.js';
describe('helper test', () => {
	it('findOrgName: known peer org', () => {
		const [orgName, _, type] = findOrgName('icddMSP');
		assert.strictEqual(orgName, 'icdd');
		assert.strictEqual(type, 'peer');
	});
	it('findOrgName: unknown peer org', () => {
		const result = findOrgName('unknown');
		assert.ok(!result);
	});
	it('findOrgName: known orderer org', () => {
		const [orgName, _, type] = findOrgName('hyperledgerMSP');
		assert.strictEqual(orgName, 'hyperledger');
		assert.strictEqual(type, 'orderer');
	});
});