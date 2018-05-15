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
Request.get(`${swarmBaseUrl}/config/orgs`, async (err, resp, body) => {
	if (err) throw err;
	body = JSON.parse(body);
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

});


