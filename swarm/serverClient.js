const logger = require('../common/nodejs/logger').new('ServerClient');
const {sha2_256} = require('fabric-client/lib/hash');
const fs = require('fs');
const path = require('path');
const {fsExtra} = require('khala-nodeutils/helper');
const {RequestPromise} = require('khala-nodeutils/request');

exports.leader = {
	update: (serverBaseUrl, {ip, hostname, managerToken, workerToken}) => {
		return RequestPromise({
			url: `${serverBaseUrl}/leader/update`,
			body: {ip, hostname, managerToken, workerToken}
		});

	},
	info: (serverBaseUrl) => {
		return RequestPromise({
			url: `${serverBaseUrl}/leader`,
			method: 'GET'
		});
	},
};
/**
 * Take care fs.write encoding specifically
 * @param serverBaseUrl
 * @param filePath
 * @returns {Promise<any>}
 */
exports.block = async (serverBaseUrl, filePath) => {
	const body = await RequestPromise({
		url: `${serverBaseUrl}/block`,
		method: 'GET'
	});
	logger.debug('check hash ', sha2_256(body));
	fsExtra.outputFileSync(path.resolve(filePath), body, 'binary');
	return filePath;
};
exports.getSignatures = (serverBaseUrl, protoPath) => {
	const formData = {
		proto: fs.createReadStream(protoPath)
	};
	return RequestPromise({
		url: `${serverBaseUrl}/`, // TODO signServerPort might be different
		formData,
	});
};

exports.createOrUpdateOrg = (serverBaseUrl, channelName, MSPID, MSPName, nodeType, {admins, root_certs, tls_root_certs}, skip) => {
	const formData = {
		MSPID, MSPName, nodeType,
		admins: admins.map(filePath => fs.createReadStream(filePath)),
		root_certs: root_certs.map(filePath => fs.createReadStream(filePath)),
		tls_root_certs: tls_root_certs.map(filePath => fs.createReadStream(filePath)),
	};
	if (skip) {
		formData.skip = 'y'; // boolean in formData will trigger  "throw new TypeError('First argument must be a string or Buffer');"
	}
	if (nodeType === 'peer') {
		formData.channelName = channelName;
	}
	const url = `${serverBaseUrl}/channel/createOrUpdateOrg`;
	logger.debug('createOrUpdateOrg', {url, formData});
	return RequestPromise({url, formData});
};
