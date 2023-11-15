import assert from 'assert';
import * as helper from '../app/helper.js';
import IDService from '../common/nodejs/identityService.js';
import AffiliationService from '../common/nodejs/affiliationService.js';
import CAService from '../common/nodejs/admin/ca.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import * as caCryptoGen from '../config/caCryptoGen.js';
import {importFrom} from '@davidkhala/light/es6.mjs';

const logger = consoleLogger('ca service');
const {TLS} = importFrom(import.meta,'../config/orgs.json');

describe('caCryptoGen', () => {
	const org = 'icdd';
	it('genUser green', async () => {
		await caCryptoGen.genExtraUser({userName: 'david'}, org, 'peer');
	});
	it('name length exceed', async () => {

		const userName = `${'david'.repeat(25)}@orgMSP`;
		try {
			// TODO fabric-ca bug: why this length illegal identity will go into CA
			await caCryptoGen.genExtraUser({userName, password: 'password'}, org, 'peer');
		} catch (e) {
			const {code, message} = e.errors[0];
			assert.strictEqual(code, 80);
			assert.ok(/' exceeds the maximum character limit of 64$/.test(message));
		}

	});
});


describe('caService', () => {
	const org = 'icdd';
	const admin = helper.getOrgAdmin(org);
	const protocol = `http${TLS ? 's' : ''}`;
	const hostname = 'localhost';
	const port = 8054;

	const caService = new CAService({protocol, hostname, port});
	const idService = new IDService(caService, admin);

	it('identity service', async () => {
		const allIDs = await idService.getAll(admin);
		logger.info(allIDs);
	});
	const affiliationService = new AffiliationService(caService, admin);
	it('AffiliationService GetAll', async () => {
		const [allDepartments] = await affiliationService.getAll();
		logger.info(allDepartments);
	});
	it('AffiliationService GetOne', async () => {
		const result = await affiliationService.getOne('icdd1');
		assert.ifError(result);

	});
	it('AffiliationService create, delete dummy', async () => {
		const name = 'dummy';
		await affiliationService.createIfNotExist(name);
		await affiliationService.delete(name);
	});
	it.skip('idemix', async () => {
		const result = await caService.idemixEnroll(admin);
		logger.info(result);
	});
});

