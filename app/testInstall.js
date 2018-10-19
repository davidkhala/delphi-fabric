const {installAll} = require('./installHelper');
const {instantiate} = require('./instantiateHelper');

const chaincodeId = process.env.name ? process.env.name : 'node';
const globalConfig = require('../config/orgs.json');
const logger = require('../common/nodejs/logger').new('testInstall', true);

const task = async () => {
	try {
		await installAll(chaincodeId);
		const peerOrg = 'ASTRI.org';
		await instantiate(peerOrg, chaincodeId);
	} catch (e) {
		logger.error(e);
		process.exit(1);
	}
};
task();

