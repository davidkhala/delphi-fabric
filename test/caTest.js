import assert from 'assert';
import * as helper from '../app/helper.js';
import IDService from '../common/nodejs/ca/identityService.js';
import AffiliationService from '../common/nodejs/ca/affiliationService.js';
import CAService from '../common/nodejs/admin/ca.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import * as caCryptoGen from '../config/caCryptoGen.js';
import {importFrom} from '@davidkhala/light/es6.mjs';
import {ping} from '../common/nodejs/ca/ca.js';

const logger = consoleLogger('ca service');
const {TLS} = importFrom(import.meta, '../config/orgs.json');

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

describe('ca service', () => {
	const org = 'icdd';
	const admin = helper.getOrgAdmin(org);
	const protocol = `http${TLS ? 's' : ''}`;
	const hostname = 'localhost';
	const port = 8054;

	const caService = new CAService({protocol, hostname, port});
	it('ping', async () => {
		logger.info(caService.url);
		const returned = await ping(caService.url);
		logger.info(returned);
	});
});


describe('AffiliationService', () => {
	const org = 'icdd';
	const admin = helper.getOrgAdmin(org);
	const protocol = `http${TLS ? 's' : ''}`;
	const hostname = 'localhost';
	const port = 8054;

	const caService = new CAService({protocol, hostname, port});
	const affiliationService = new AffiliationService(caService, admin);
	it('GetAll', async () => {
		const [allDepartments] = await affiliationService.getAll();
		logger.info(allDepartments);
	});
	it('GetOne', async () => {
		const result = await affiliationService.getOne('icdd1');
		assert.ifError(result);

	});
	it('create and delete dummy', async () => {
		const name = 'dummy';
		await affiliationService.createIfNotExist(name);
		await affiliationService.delete(name);
	});

});
describe('identity service', function () {
	const org = 'icdd';
	const admin = helper.getOrgAdmin(org);
	const protocol = `http${TLS ? 's' : ''}`;
	const hostname = 'localhost';
	const port = 8054;

	const caService = new CAService({protocol, hostname, port});
	const idService = new IDService(caService, admin, logger);
	it('getAll', async () => {
		const allIDs = await idService.getAll();
		logger.info(allIDs);
	});
	it('getOne', async () => {
		const one = await idService.getOne({enrollmentID: 'Admin'});
		logger.info(one);
	});
	it('getOne: on not exist', async () => {
		assert.ifError(await idService.getOne({enrollmentID: 'admin'}));

	});
});

