const helper = require('../app/helper');
const IdentityService = require('../common/nodejs/builder/identityService');
const CAUtil = require('../common/nodejs/ca');
const CA = require('../common/nodejs/builder/ca');
const logger = require('khala-logger/log4js').consoleLogger('test:ca');

const task = async (taskID) => {
	const org = 'icdd';
	const caUrl = 'https://localhost:8054';
	const admin = helper.getOrgAdminUser(org);
	const caService = new CA(caUrl).caService;

	let result;
	switch (taskID) {
		case 0: {
			const idService = new IdentityService(caService);
			const allIDs = await idService.getAll(admin);
			for (const id of allIDs) {
				logger.debug(id.id, id.attrs);
			}
		}

			break;
		case 1:
			result = await CAUtil.intermediateCA.register(caService, admin, {
				enrollmentID: `${org}.intermediate`,
				affiliation: org,
				enrollmentSecret: 'password'
			});
			logger.debug(result);
			break;

	}


};
task(parseInt(process.env.taskID));