const config = require('../config');
const dockerUtil = require('../../../app/util/dockerode');
const Request = require('request');
const swarmServerConfig = require('../../../swarm/swarm');
const swarmBaseUrl = `${swarmServerConfig.swarmServer.url}:${swarmServerConfig.swarmServer.port}`;
const ordererOrg ='NewConsensus';
const peerOrg='NEW';
const container_name = {
	ordererCA: `ca.${ordererOrg}`,
	peerCA: `ca.${peerOrg}`
};
Request.get(`${swarmBaseUrl}/config/orgs`, (err, resp, body) => {
	if (err) throw err;
	body =JSON.parse(body);
	const imageTag = `x86_64-${body.docker.fabricTag}`;
	const {network} = body.docker;

	return dockerUtil.deployNewCA({
		Name: container_name.ordererCA,
		port: config.orderer.orgs.NewConsensus.ca.portHost,
		network, imageTag,
		Constraints:config.swarm.Constraints
	}).then(() => {
		return dockerUtil.deployNewCA({
			Name: container_name.peerCA,
			port: config.orgs.NEW.ca.portHost,
			Constraints:config.swarm.Constraints,
			network,imageTag
		});
	}).then(()=>{
		return new Promise((resolve)=>{
			const time=150000;
			console.log(`Wait ${time}`);
			setTimeout(()=>{
				//gen ca
				resolve();
			},time);
		});

	});

});


