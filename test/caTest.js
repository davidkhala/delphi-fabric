const helper = require('../app/helper');
const IdentityService = require('../common/nodejs/builder/identityService');
const AffiliationService = require('../common/nodejs/builder/affiliationService');
const CertificateService = require('../common/nodejs/builder/certificateService');
const CAUtil = require('../common/nodejs/ca');
const CA = require('../common/nodejs/builder/ca');
const logger = require('khala-logger/log4js').consoleLogger('test:ca');
const assert = require('assert');
describe('CA Test', function () {
	this.timeout(3000);
	const org = 'icdd';
	const caUrl = 'https://localhost:8054';
	const admin = helper.getOrgAdminUser(org);
	const caService = new CA(caUrl).caService;
	it('list id', async () => {
		const idService = new IdentityService(caService);
		const allIDs = await idService.getAll(admin);
		for (const id of allIDs) {
			logger.debug(id.id, id.attrs);
		}
	});
	it('revoke id', async () => {
		const enrollmentID = `User-${Date.now()}`;
		const enrollmentSecret = 'password';
		const reason = 'reason here';
		const idService = new IdentityService(caService);
		await CAUtil.register(caService, admin, {enrollmentID, enrollmentSecret, affiliation: org, role: 'user'});
		const revokeResult = await idService.revokeIdentity(enrollmentID, admin, reason);
		logger.debug(revokeResult);

	});
	it('list Affiliation', async () => {
		const affiliationService = new AffiliationService(caService);
		const affiliations = await affiliationService.getAll(admin);
		logger.info(affiliations);

	});
	it('list certificates', async () => {
		const certificateService = new CertificateService(caService);
		const result = await certificateService.getAll(admin);
		logger.info(result);

	});
	it('register', async () => {
		const {enrollmentID, enrollmentSecret, status} = await CAUtil.intermediateCA.register(caService, admin, {
			enrollmentID: `${org}.intermediate`,
			affiliation: org,
			enrollmentSecret: 'password'
		});
		assert.strictEqual(enrollmentSecret, 'password');
		assert.ok(['assigned', 'existed'].includes(status));
		assert.strictEqual(enrollmentID, `${org}.intermediate`);
	});
	it('revoke', async () => {
		const certificateService = new CertificateService(caService);
		const enrollmentID = 'Admin';
		const enrollmentSecret = 'passwd';
		const {certificate} = await caService.enroll({enrollmentID, enrollmentSecret});
		logger.debug(certificate);
		const {aki, serial} = CertificateService.inspect(certificate);
		logger.info('to be revoke', {aki, serial});
		const result = await certificateService.revokeCertificate(certificate, admin, 'optional reason');
		logger.debug(result);


		const allCerts = await certificateService.getAll(admin, {includeExpired: true});
		assert.strictEqual(allCerts.length, 8);
	});
});