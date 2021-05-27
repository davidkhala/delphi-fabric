const helper = require('../app/helper');
const IDService = require('../common/nodejs/identityService');
const AffiliationService = require('../common/nodejs/affiliationService');
const CAService = require('../common/nodejs/CAService');
const logger = require('khala-logger/log4js').consoleLogger('ca service');
const caCryptoGen = require('../config/caCryptoGen');

const assert = require('assert');
const {TLS} = require('../config/orgs.json');
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
	const caUrl = `http${TLS ? 's' : ''}://localhost:8054`;
	const admin = helper.getOrgAdmin(org);
	const {caService} = new CAService(caUrl);
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

