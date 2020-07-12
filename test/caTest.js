const helper = require('../app/helper');
const IDService = require('../common/nodejs/admin/identityService');
const CAService = require('../common/nodejs/admin/ca');
const logger = require('khala-logger/log4js').consoleLogger('ca service');
const caCryptoGen = require('../config/caCryptoGen');
require('chai').should();
describe('caCryptoGen', () => {
	const org = 'icdd';
	it('genUser green', async () => {
		await caCryptoGen.genUser({userName: 'david'}, org);
	});
	it('name length exceed', async () => {
		// TODO fabric-ca bug: why this length illegal identity will go into CA
		const userName = `${'david'.repeat(25)}@orgMSP`;
		try {
			await caCryptoGen.genUser({userName}, org);
		} catch (e) {
			e.errors[0].code.should.equal(0);
			e.errors[0].message.should.match(/The CN '\S+' exceeds the maximum character limit of 64/);

		}

	});
});


describe('caService', async () => {
	const org = 'icdd';
	const caUrl = 'https://localhost:8054';
	const admin = helper.getOrgAdmin(org);
	const caService = new CAService(caUrl);
	it('identity service', async () => {
		const idService = new IDService(caService.caService);
		const allIDs = await idService.getAll(admin);
		logger.info(allIDs);
	});
	it('idemix', async () => {
		const result = await caService.idemixEnroll(admin);
		logger.info(result);
	});
});

