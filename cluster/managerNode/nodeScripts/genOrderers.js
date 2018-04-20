const config = require('../config');
const dockerUtil = require('../../../app/util/dockerode');

const Request = require('request');
const swarmServerConfig = require('../../../swarm/swarm');
const swarmBaseUrl = `${swarmServerConfig.swarmServer.url}:${swarmServerConfig.swarmServer.port}`;
const ordererOrg = 'NewConsensus';
const peerOrg = 'NEW';
const nodeHost = config.swarm.nodeHost;
const ordererName = 'orderer0';
Request.get(`${swarmBaseUrl}/config/orgs`, (err, resp, body) => {
	if (err) throw err;
	body = JSON.parse(body);
	const imageTag = `x86_64-${body.docker.fabricTag}`;
	const {network} = body.docker;

	// {Name,network,imageTag,Constraints,port,msp:{volumeName,configPath, id},CONFIGTXVolume,BLOCK_FILE,kafkas,tls}
	dockerUtil.deployNewOrderer({
		Name:`${ordererName}.${ordererOrg}`,
		imageTag, network,
		Constraints: config.swarm.Constraints,
		port:config.orderer.orgs[ordererOrg].orderers[ordererName].portHost,
        msp:{volumeName:config.orderer.orgs.NewConsensus}
	});
});