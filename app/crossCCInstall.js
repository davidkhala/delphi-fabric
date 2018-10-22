const {installAll} = require('./installHelper');
const {instantiate} = require('./instantiateHelper');
const mainCC = 'mainChain';
const sideCC = 'sideChain';
const sideCC2 = 'sideChain2';
const task = async () => {
	await installAll(mainCC);
	await installAll(sideCC);
	await installAll(sideCC2);
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';
	await instantiate(org1, mainCC);
	await instantiate(org2, sideCC);
	await instantiate(org1, sideCC2);
};
task();