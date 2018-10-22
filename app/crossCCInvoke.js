const {invoke} = require('./invokeHelper');
const mainCC = 'mainChain';
const sideCC = 'sideChain';
const sideCC2 = 'sideChain2';
const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('crossCC Invoke');
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
	const keys = await put();
	const [key1, key2] = keys.split('|');
	const value2 = await get(key2);
	logger.debug({value2});
};
flow();
