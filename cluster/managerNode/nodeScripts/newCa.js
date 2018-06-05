const config = require('./config');
const logger = require('../../../common/nodejs/logger').new('newCa')
const {serviceClear, swarmServiceName} = require('../../../common/docker/nodejs/dockerode-util');
const {tasksWaitUntilLive, deployCA} = require('../../../common/nodejs/fabric-dockerode');
const ordererOrg = 'NewConsensus';
const peerOrg = 'NEW';
const container_name = {
	ordererCA: `ca.${ordererOrg}`,
	peerCA: `ca.${peerOrg}`
};
const {globalConfig} = require('./swarmClient');
const asyncTask = async () => {
	const body = await globalConfig;
	const {docker: {network, fabricTag}, TLS} = body;
	const imageTag = `x86_64-${fabricTag}`;
	const ordererCAServiceName = swarmServiceName(container_name.ordererCA);
	const peerCAServiceName = swarmServiceName(container_name.peerCA);
	await serviceClear(ordererCAServiceName);
	await serviceClear(peerCAServiceName);
	if (process.env.action === 'down') return;
	const ordererCA = await deployCA({
		Name: container_name.ordererCA,
		port: config.orderer.orgs.NewConsensus.ca.portHost,
		network, imageTag, TLS
	});
	const peerCA = await deployCA({
		Name: container_name.peerCA,
		port: config.orgs.NEW.ca.portHost,
		network, imageTag, TLS
	});
	const caServices = [ordererCA, peerCA];

	await tasksWaitUntilLive(caServices);
};
asyncTask();


