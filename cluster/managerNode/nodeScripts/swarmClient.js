const config = require('./config');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const Request = require('request');
const logger = require('../../../common/nodejs/logger').new('api caller');
const serverClient = require('../../../common/nodejs/express/serverClient');
exports.globalConfig = new Promise((resolve, reject) => {
	Request.get(`${swarmBaseUrl}/config/orgs`, (err, resp, body) => {
		if (err) reject(err);
		body = JSON.parse(body);
		resolve(body);
	});
});
exports.block = (filePath)=>serverClient.block(swarmBaseUrl,filePath);
exports.newOrg= (cryptoPath, nodeType,channelName,orgName)=>{
	let orgConfig;
	const {msp} = cryptoPath.OrgFile(nodeType);
	const admins = [msp.admincerts];
	const root_certs = [msp.cacerts];
	const tls_root_certs = [msp.tlscacerts];

	if(nodeType === 'orderer'){
		orgConfig = config.orderer.orgs[orgName];
	}else {
		orgConfig = config.orgs[orgName];
	}
	const MSPID = orgConfig.MSP.id;
	const MSPName = orgConfig.MSP.name;

	return serverClient.newOrg(swarmBaseUrl,channelName,MSPID,MSPName,nodeType,{admins,root_certs,tls_root_certs});
};