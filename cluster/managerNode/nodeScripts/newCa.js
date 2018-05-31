const config = require('./config');
const fabricDockerode = require('../../../common/nodejs/fabric-dockerode');
const logger = require('../../../common/nodejs/logger').new('newCa')
const {tasksWaitUntilLive,serviceDelete,swarmServiceName, tasksWaitUntilDead} = require('../../../common/docker/nodejs/dockerode-util');
const ordererOrg = 'NewConsensus';
const peerOrg = 'NEW';
const container_name = {
	ordererCA: `ca.${ordererOrg}`,
	peerCA: `ca.${peerOrg}`
};
const globalConfigPromise = require('./globalConfigPromise');
const asyncTask = async () => {
	const body = await globalConfigPromise;
	const imageTag = `x86_64-${body.docker.fabricTag}`;
	const {docker: {network}, TLS} = body;
	const ordererCAServiceName=swarmServiceName(container_name.ordererCA);
	const peerCAServiceName =swarmServiceName(container_name.peerCA);
	await serviceDelete(ordererCAServiceName);
	await serviceDelete(peerCAServiceName);
	try {
		await tasksWaitUntilDead({services:[ordererCAServiceName,peerCAServiceName]});
	}catch(err){
		if(err.toString().includes('not found')){
			logger.warn(err);
		}else throw err;
	}
	const ordererCA = await fabricDockerode.deployCA({
		Name: container_name.ordererCA,
		port: config.orderer.orgs.NewConsensus.ca.portHost,
		network, imageTag, TLS
	});
	const peerCA = await fabricDockerode.deployCA({
		Name: container_name.peerCA,
		port: config.orgs.NEW.ca.portHost,
		network, imageTag, TLS
	});
	const caServices = [ordererCA, peerCA];

	await tasksWaitUntilLive(caServices);
};
asyncTask();


