const {sleep} = require('../../common/nodejs');
const {stopOrderer, resumeOrderer} = require('../../operations/backup');
const org = 'icdd.astri.org';

const flow = async () => {
	await stopOrderer(org, 2);
	await sleep(5000);
	await resumeOrderer(org, 2);
};
flow();
