//TODO send manager info to swarm Server
const swarmClient = require('./swarmClient');
const {fabricImagePull,swarmIPJoin} = require('../../common/nodejs/fabric-dockerode');
const {swarmLeave,swarmBelongs} = require('../../common/docker/nodejs/dockerode-util');
const dockerCmdUtil = require('../../common/docker/nodejs/dockerCmd');
const arch = 'x86_64';
const commonHelper = require('../../common/nodejs/helper');
const logger = require('../../common/nodejs/logger').new('prepare');
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
	await fabricImagePull({fabricTag, thirdPartyTag, arch});
	await swarmIPJoin({AdvertiseAddr, JoinToken});
	const node = await dockerCmdUtil.nodeSelf(true);
	logger.info('this node',node);


};
asyncTask();
