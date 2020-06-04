const helper = require('../app/helper');
const IDService = require('../common/nodejs/admin/identityService');
const CAService = require('../common/nodejs/admin/ca');
const logger = require('khala-logger/log4js').consoleLogger('ca service');
const caCryptoGen = require('../config/caCryptoGen');
const should = require('chai').should();
describe('caCryptoGen', () => {
	const org = 'icdd';
	it('genUser green', async () => {
		await caCryptoGen.genUser({userName: 'david'}, org);
	});
	it('name length exceed', async () => {
		// [[{"code":0,"message":"The CN 'david.repeat(20)@Merchant' exceeds the maximum character limit of 64"}]]
		const userName = `${'david'.repeat(20)}@orgMSP`;
		try {
			await caCryptoGen.genUser({userName}, org);
		} catch (e) {
			const regExp = /\[\[{"code":0,"message":"The CN '\S+' exceeds the maximum character limit of 64"}]]$/;
			e.message.should.match(regExp);

			logger.error(e);
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
});

