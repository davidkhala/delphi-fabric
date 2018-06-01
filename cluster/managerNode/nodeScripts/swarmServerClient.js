const logger = require('../../../common/nodejs/logger').new('swarmServerClient');
const {sha2_256} = require('fabric-client/lib/hash');
const fs = require('fs');
const path = require('path');
const fsExtra= require('fs-extra');
const requestBuilder = ({uri, body}) => {
	return {
		method: 'POST',
		uri,
		body,
		json: true
	};
};
const errHandler = (resolve, reject) => (err, resp, body) => {
	if (err) reject(err);
	resolve(body);
};
const Request = require('request');
//TODO have not cover all API yet
exports.ping = (serverBaseUrl) => {
	return new Promise((resolve, reject) => {
		Request.get(`${serverBaseUrl}/`, errHandler(resolve, reject));
	});
};
exports.manager = {
	join: (serverBaseUrl, {ip, hostname}) => {
		logger.info('managerJoin', {serverBaseUrl, ip, hostname});
		return new Promise((resolve, reject) => {
			Request(requestBuilder({
				uri: `${serverBaseUrl}/manager/join`,
				body: {ip, hostname}
			}), errHandler(resolve, reject));
		});
	},
	leave: (serverBaseUrl, {ip}) => {
		logger.info('managerLeave', {serverBaseUrl, ip});
		return new Promise((resolve, reject) => {
			Request(requestBuilder({
				uri: `${serverBaseUrl}/manager/leave`,
				body: {ip}
			}), errHandler(resolve, reject));
		});
	}
};
exports.leader = {
	update: (serverBaseUrl, {ip, hostname, managerToken}) => {
		return new Promise((resolve, reject) => {
			Request(requestBuilder({
				uri: `${serverBaseUrl}/leader/update`,
				body: {ip, hostname, managerToken}
			}), errHandler(resolve, reject));
		});
	}
};
/**
 * Take care fs.write encoding specifically
 * @param swarmBaseUrl
 * @param filePath
 * @returns {Promise<any>}
 */
exports.block = (swarmBaseUrl,filePath) => {
	return new Promise((resolve, reject) => {
		Request.get(`${swarmBaseUrl}/block`, (err, resp, body) => {
			if (err) reject(err);
			logger.debug('check hash ', sha2_256(body));
			fsExtra.ensureDirSync(path.dirname(filePath));
			fs.writeFileSync(path.resolve(filePath),body,'binary');
			resolve(filePath);
		});
	});
};


