const config = require('./config');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const Request = require('request');
const logger = require('../../../common/nodejs/logger').new('api caller');
exports.globalConfig = new Promise((resolve, reject) => {
	Request.get(`${swarmBaseUrl}/config/orgs`, (err, resp, body) => {
		if (err) reject(err);
		body = JSON.parse(body);
		resolve(body);
	});
});
exports.block = (filePath)=>require('./swarmServerClient').block(swarmBaseUrl,filePath);