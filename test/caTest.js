const helper = require('../app/helper');
const IDService = require('../common/nodejs/identityService');
const CAUtil = require('../common/nodejs/ca');
const logger = require('khala-logger/dev').devLogger('test:ca');

const identitySericeTask = async (caService, admin) => {
	const idService = IDService.new(caService);
	return await IDService.getAll(idService, admin);
};

const task = async (taskID) => {
	const org = 'icdd';
	const caUrl = 'https://localhost:8054';
	const admin = helper.getOrgAdminUser(org);
	const caService = CAUtil.new(caUrl);

	let result;
	switch (taskID) {
		case 0:
			const allIDs = await identitySericeTask(caService, admin);
			for (const id of allIDs) {
				logger.debug(id.id, id.attrs);
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