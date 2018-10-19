const {installAll} = require('./installHelper');
const {instantiate} = require('./instantiateHelper');
const mainCC = 'mainChain';
const sideCC = 'sideChain';
const task = async () => {
	await installAll(mainCC);
	await installAll(sideCC);
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';
	await instantiate(org1, mainCC);
	await instantiate(org2, sideCC);
};
task();