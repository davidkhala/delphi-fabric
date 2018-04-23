const config = require('./config');
const dockerUtil = require('../../../app/util/dockerode');
const Request = require('request');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const ordererOrg = 'NewConsensus';
const peerOrg = 'NEW';
const container_name = {
	ordererCA: `ca.${ordererOrg}`,
	peerCA: `ca.${peerOrg}`
};
Request.get(`${swarmBaseUrl}/config/orgs`, (err, resp, body) => {
	if (err) throw err;
	body = JSON.parse(body);
	const imageTag = `x86_64-${body.docker.fabricTag}`;
	const {network} = body.docker;

	return dockerUtil.deployNewCA({
		Name: container_name.ordererCA,
		port: config.orderer.orgs.NewConsensus.ca.portHost,
		network, imageTag,
		Constraints: config.swarm.Constraints
	}).then(() => {
		return dockerUtil.deployNewCA({
			Name: container_name.peerCA,
			port: config.orgs.NEW.ca.portHost,
			Constraints: config.swarm.Constraints,
			network, imageTag
		});
	}).then(() => dockerUtil.findTask({service: 'ca-NEW'}))
		.then((task)=>{if(!Array.isArray(task)||task.length===0){
			console.error('task not found');
		}else {
			console.log('task found');
			console.log(task[0].Status);
		}});

});


