//TODO send manager info to swarm Server
const config = require('./config');
const swarmClient = require('./swarmClient');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const {imagePull} = require('../../../common/nodejs/fabric-dockerode');
const {swarmJoin, swarmLeave,swarmBelongs} = require('../../../common/docker/nodejs/dockerode-util');
const dockerCmdUtil = require('../../../common/docker/nodejs/dockerCmd');
const arch = 'x86_64';
const commonHelper = require('../../../common/nodejs/helper');
const logger = require('../../../common/nodejs/logger').new('prepare');
const asyncTask = async () => {
	await swarmClient.touch();
	const {managerToken} = await swarmClient.leader();
	const {token: JoinToken, AdvertiseAddr} = await dockerCmdUtil.advertiseAddr(managerToken);

	const {result} = await swarmBelongs(undefined,JoinToken);
	if(!result){
		await swarmLeave();
	}

	if (process.env.action === 'down') return;
	const {docker: {network, thirdPartyTag, fabricTag}, TLS} = await swarmClient.globalConfig();
	await imagePull({fabricTag, thirdPartyTag, arch});
	await swarmJoin({AdvertiseAddr, JoinToken});



	const ip = commonHelper.ip()[0];
	const hostname = commonHelper.hostname();

	await swarmClient.managerJoin(ip, hostname);
};
asyncTask();
