const {invoke} = require('../../app/invokeHelper');
const mainCC = 'mainChain';
const sideCC = 'sideChain';
const sideCC2 = 'sideChain2';
const helper = require('../../app/helper');
const logger = require('../../common/nodejs/logger').new('crossCC Invoke');
const put = async () => {
	const org1 = 'ASTRI.org';
	const peers = helper.newPeers([0], org1);
	const fcn = 'put';
	const response = await invoke(peers, org1, sideCC, fcn);
	return response[0];
};
const get = async (key) => {
	const org2 = 'icdd';
	const peers = helper.newPeers([0], org2);
	const fcn = 'get';
	const args = [key];
	const response = await invoke(peers, org2, sideCC2, fcn, args);
	return response[0];
};
const flow = async () => {
	const key = await put();
	try {
		const value2 = await get(key);
		logger.debug({value2});
	} catch (err) {
		logger.error(err);
	}

};
flow();
