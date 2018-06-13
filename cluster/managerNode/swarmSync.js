//TODO send manager info to swarm Server
const swarmClient = require('./swarmClient');
const {fabricImagePull, swarmIPJoin} = require('../../common/nodejs/fabric-dockerode');
const {swarmLeave, swarmBelongs} = require('../../common/docker/nodejs/dockerode-util');
const dockerCmdUtil = require('../../common/docker/nodejs/dockerCmd');
const arch = 'x86_64';
const logger = require('../../common/nodejs/logger').new('swarmSync');
const asyncTask = async (action) => {
	await swarmClient.touch();
	const {managerToken} = await swarmClient.leader();
	const {token: JoinToken, AdvertiseAddr} = await dockerCmdUtil.advertiseAddr(managerToken);


	if (action === 'down') {
		const {result} = await swarmBelongs(undefined, JoinToken);
		if (!result) {
			await swarmLeave();
		}
		logger.info('[done] down');
		return;
	}
	const {docker: {network, thirdPartyTag, fabricTag}, TLS} = await swarmClient.globalConfig();
	await fabricImagePull({fabricTag, thirdPartyTag, arch});
	await swarmIPJoin({AdvertiseAddr, JoinToken});
	const node = await dockerCmdUtil.nodeSelf(true);
	logger.info('this node', node);


};
asyncTask(process.env.action);
