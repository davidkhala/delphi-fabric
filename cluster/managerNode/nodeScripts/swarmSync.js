//TODO send manager info to swarm Server
const config = require('./config');
const swarmClient = require('./swarmClient');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const {imagePull} = require('../../../common/nodejs/fabric-dockerode');
const {swarmJoin} = require('../../../common/docker/nodejs/dockerode-util');
const dockerCmdUtil = require('../../../common/docker/nodejs/dockerCmd');
const arch = 'x86_64';
const logger= require('../../../common/nodejs/logger').new('prepare');
const asyncTask = async () => {
	await swarmClient.touch();
	const {docker: {network, thirdPartyTag, fabricTag}, TLS} = await swarmClient.globalConfig();
	await imagePull({fabricTag,thirdPartyTag,arch});
	const {managerToken} = await swarmClient.leader();
	const {token:JoinToken,AdvertiseAddr} = await dockerCmdUtil.advertiseAddr(managerToken);

	try {
		await swarmJoin({AdvertiseAddr, JoinToken});
	}catch (err) {
		logger.error(err);
	}
};
asyncTask();
