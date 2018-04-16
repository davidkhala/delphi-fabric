
const caUtil = require('./app/util/ca');

const ca = caUtil.new('http://0.0.0.0:7450')
const caHelper = require('./app/caHelper');
const userUtil = require('./app/util/user');
const affiliationRoot = 'TK';
const ordererName = 'orderer0';
caHelper.getOrdererAdmin({ordererName},ca)
	.then(adminUser => {
		//manage affiliation;
		const affiliationService = ca.newAffiliationService();
		const force = true;//true to create recursively
		const affiliationUtil = require('./app/util/affiliationService');

		const promises = [affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.user`, force}, adminUser),
			affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.peer`, force}, adminUser),
			affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.orderer`, force}, adminUser)];
		return Promise.all(promises).then(() => Promise.resolve(adminUser));
	}).then((adminUser) => {
		return caHelper.enrollOrderer({ordererName,ordererPort:7050},ca);


	}).catch(err => {
		console.error(err);
	});