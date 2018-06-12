const config = require('./config');
const logger = require('../../common/nodejs/logger').new('newCa');
const {serviceClear, swarmServiceName} = require('../../common/docker/nodejs/dockerode-util');
const {tasksWaitUntilLive, deployCA} = require('../../common/nodejs/fabric-dockerode');
const ordererOrg = 'NewConsensus';
const peerOrg = 'NEW';
const container_name = {
	ordererCA: `ca.${ordererOrg}`,
	peerCA: `ca.${peerOrg}`
};
const {globalConfig} = require('./swarmClient');
const asyncTask = async (action) => {

	if (action === 'down') {
		const ordererCAServiceName = swarmServiceName(container_name.ordererCA);
		const peerCAServiceName = swarmServiceName(container_name.peerCA);
		await serviceClear(ordererCAServiceName);
		await serviceClear(peerCAServiceName);
		logger.info('[done] down');
		return;
	}
	const {docker: {network, fabricTag}, TLS} = await globalConfig();
	const imageTag = `x86_64-${fabricTag}`;
	const ordererCA = await deployCA({
		Name: container_name.ordererCA,
		port: config.orderer.orgs[ordererOrg].ca.portHost,
		network, imageTag, TLS
	});
	const peerCA = await deployCA({
		Name: container_name.peerCA,
		port: config.orgs[peerOrg].ca.portHost,
		network, imageTag, TLS
	});
	const caServices = [ordererCA, peerCA];

	await tasksWaitUntilLive(caServices);
};
try {
	asyncTask(process.env.action);
} catch (err) {
	logger.error(err);
	process.exit(1);
}



