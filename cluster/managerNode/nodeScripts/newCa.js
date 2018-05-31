const config = require('./config');
const fabricDockerode = require('../../../common/nodejs/fabric-dockerode');
const dockerUtil = require('../../../common/docker/nodejs/dockerode-util');
const Request = require('request');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const ordererOrg = 'NewConsensus';
const peerOrg = 'NEW';
const container_name = {
	ordererCA: `ca.${ordererOrg}`,
	peerCA: `ca.${peerOrg}`
};
const globalConfigPromise = async () => {
	return new Promise((resolve, reject) => {
		Request.get(`${swarmBaseUrl}/config/orgs`, (err, resp, body) => {
			if (err) reject(err);
			body = JSON.parse(body);
			resolve(body);
		});
	});
};
const asyncTask = async ()=>{
	const body = await globalConfigPromise();
	const imageTag = `x86_64-${body.docker.fabricTag}`;
	const {network} = body.docker;
	await fabricDockerode.deployCA({
		Name: container_name.ordererCA,
		port: config.orderer.orgs.NewConsensus.ca.portHost,
		network, imageTag,
		Constraints: config.swarm.Constraints
	});
	await fabricDockerode.deployCA({
		Name: container_name.peerCA,
		port: config.orgs.NEW.ca.portHost,
		Constraints: config.swarm.Constraints,
		network, imageTag
	});
	const task = await dockerUtil.findTask({service: 'ca-NEW'});
};
asyncTask();


