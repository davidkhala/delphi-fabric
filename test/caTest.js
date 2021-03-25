const helper = require('../app/helper');
const IdentityService = require('../common/nodejs/builder/identityService');
const AffiliationService = require('../common/nodejs/builder/affiliationService');
const CAUtil = require('../common/nodejs/ca');
const CA = require('../common/nodejs/builder/ca');
const logger = require('khala-logger/log4js').consoleLogger('test:ca');

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
	it('list Affiliation', async () => {
		const affiliationService = new AffiliationService(caService);
		const affiliations = await affiliationService.getAll(admin);
		logger.info(affiliations);

	});
	it('register', async () => {
		const result = await CAUtil.intermediateCA.register(caService, admin, {
			enrollmentID: `${org}.intermediate`,
			affiliation: org,
			enrollmentSecret: 'password'
		});
		logger.debug(result);
	});
});