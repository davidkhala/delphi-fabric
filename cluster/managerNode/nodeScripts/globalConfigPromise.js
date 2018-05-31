const config = require('./config');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const Request = require('request');
module.exports = new Promise((resolve, reject) => {
	Request.get(`${swarmBaseUrl}/config/orgs`, (err, resp, body) => {
		if (err) reject(err);
		body = JSON.parse(body);
		resolve(body);
	});
});