const requestPromise = require('request-promise-native');
const logger = require('../common/nodejs/logger').new('swarmServerClient');
const requestBuilder = ({uri, body}) => {
	return {
		method: 'POST',
		uri,
		body,
		json: true
	};
};
//TODO have not cover all API yet
exports.ping = async (serverBaseUrl)=>{
	const result = await requestPromise(`${serverBaseUrl}/`);
};
exports.manager = {
	join: async (serverBaseUrl, {ip, hostname}) => {
		logger.info('managerJoin', {serverBaseUrl, ip, hostname});
		return await requestPromise(requestBuilder({
			uri: `${serverBaseUrl}/manager/join`,
			body: {ip, hostname}
		}));
	},
	leave: async (serverBaseUrl, {ip}) => {
		logger.info('managerLeave', {serverBaseUrl, ip});
		return await requestPromise(requestBuilder({
			uri: `${serverBaseUrl}/manager/leave`,
			body: {ip}
		}));
	}
};
exports.leader = {
	update: async (serverBaseUrl, {ip, hostname, managerToken}) => {
		return await requestPromise(requestBuilder({
			uri:`${serverBaseUrl}/leader/update`,
			body:{ip,hostname,managerToken}
		}));
	}
};


