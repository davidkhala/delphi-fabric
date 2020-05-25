const {invoke, query} = require('../../../app/invokeHelper');
const {base64} = require('khala-nodeutils/format');
const chaincodeId = 'diagnose';
const helper = require('../../../app/helper');
exports.put = async (peers, clientOrg, key, value) => {
	const fcn = 'put';
	const args = [key, JSON.stringify(value)];
	return invoke(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.putRaw = async (peers, clientOrg, key, value) => {
	const fcn = 'putRaw';
	const args = [key, value];
	return invoke(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.getRaw = async (peers, clientOrg, key) => {
	const fcn = 'getRaw';
	const args = [key];
	return query(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.get = async (peers, clientOrg, key) => {
	const fcn = 'get';
	const args = [key];
	return query(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.whoami = async (peers, clientOrg) => {
	return query(peers, clientOrg, chaincodeId, {fcn: 'whoami'});
};
exports.history = async (peers, clientOrg, key) => {
	const results = await query(peers, clientOrg, chaincodeId, {
		fcn: 'history', args: [key]
	});
	return results.map(result => {
		return JSON.parse(result).map(modification => {
			const converted = Object.assign({}, modification);
			converted.Value = base64.decode(modification.Value);
			return converted;
		});
	});
};
exports.cross = async (peers, clientOrg, targetChaincode, fcn, args) => {

	return invoke(peers, clientOrg, chaincodeId, {
		fcn: 'delegate', args: [JSON.stringify({
			ChaincodeName: targetChaincode,
			Fcn: fcn,
			Args: Array.isArray(args) ? args : [],
			Channel: ''
		})]
	});
};

const {queryBuilder} = require('../../../common/nodejs/couchdb');

exports.richQuery = async (peers, clientOrg, selector) => {
	const fcn = 'richQuery';
	const args = [queryBuilder(selector, ['Time'], 1)];
	return query(peers, clientOrg, chaincodeId, {
		fcn, args
	});
};
exports.putEndorsement = async (peers, clientOrg, key, mspids) => {
	const fcn = 'putEndorsement';
	const args = [key, ...mspids];
	return invoke(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.getEndorsement = async (peers, clientOrg, key) => {
	const fcn = 'getEndorsement';
	const args = [key];
	return query(peers, clientOrg, chaincodeId, {fcn, args});
};

exports.panic = async (peers, clientOrg) => {
	const fcn = 'panic';
	return query(peers, clientOrg, chaincodeId, {fcn});
};
exports.getPage = async (peers, clientOrg, startKey = '', endKey = '', pageSize = '1', bookMark = '') => {
	const fcn = 'listPage';
	const args = [startKey, endKey, pageSize.toString(), bookMark];
	return query(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.list = async (peers, clientOrg) => {
	const fcn = 'worldStates';
	return query(peers, clientOrg, chaincodeId, {fcn});
};
exports.putBatch = async (peers, clientOrg, map) => {
	const fcn = 'putBatch';
	const args = [JSON.stringify(map)];
	return invoke(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.chaincodeID = async (peers, clientOrg) => {
	const fcn = 'chaincodeId';
	return query(peers, clientOrg, chaincodeId, {fcn});
};
exports.getCertID = async (peers, clientOrg) => {
	const fcn = 'getCertID';
	return query(peers, clientOrg, chaincodeId, {fcn});
};


const task = async () => {
	switch (parseInt(process.env.taskID)) {
		case 0: {
			// taskID=0 node cc/golang/diagnose/diagnoseInvoke.js

			const peers = helper.allPeers();
			const org = 'icdd';
			const value = Date.now().toString();
			const key = 'a';
			await exports.putRaw(peers, org, key, value);
			const queryResult = await exports.getRaw(peers, org, key, value);
			console.debug(queryResult);
		}
			break;
		default: {
			// node cc/golang/diagnose/diagnoseInvoke.js
			const peers = helper.allPeers();
			const org = 'icdd';
			await invoke(peers, org, chaincodeId, {
				init: true,
			});
		}

	}

};
task();