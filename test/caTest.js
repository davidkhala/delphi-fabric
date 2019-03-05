const helper = require('../app/helper');
const IDService = require('../common/nodejs/identityService');
const CAUtil = require('../common/nodejs/ca');

const nameLengthTask = async (org) => {
	// [[{"code":0,"message":"The CN 'david.repeat(20)@Merchant' exceeds the maximum character limit of 64"}]]
	const caCryptoGen = require('../config/caCryptoGen');
	caCryptoGen.genUser({userName: 'david'.repeat(5)}, org);
};
const identitySericeTask = async (caService, admin) => {
	const idService = IDService.new(caService);
	return await IDService.getAll(idService, admin);
};

const task = async () => {
	const org = 'icdd';
	const caUrl = 'https://localhost:8054';
	const admin = await helper.getOrgAdminUser(org);
	const caService = CAUtil.new(caUrl);

	const allIDs = await identitySericeTask(caService, admin);
	console.log(allIDs);
};
task();