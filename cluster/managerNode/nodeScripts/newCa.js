const config = require('../config');
const dockerUtil = require('../../../app/util/dockerode');

//request swarm:
const Request = require('request');
const swarmServerConfig = require('../../../swarm/swarm')
const swarmBaseUrl = `${swarmServerConfig.swarmServer.url}:${swarmServerConfig.swarmServer.port}`;
const container_name = {
    ordererCA: 'ca.NewConsensus',
    peerCA: 'ca.New'
};
Request.get(`${swarmBaseUrl}/config/orgs`, (err, resp, body) => {
    if (err) throw err;
    body =JSON.parse(body)
    const imageTag = `x86_64-${body.docker.fabricTag}`
    const {network} = body.docker
    return dockerUtil.runNewCA({
        container_name: container_name.ordererCA,
        port: config.orderer.orgs.NewConsensus.ca.portHost,
        network, imageTag
    }).then(() => {
        return dockerUtil.runNewCA({
            container_name: container_name.peerCA,
            port: config.orgs.NEW.ca.portHost,
            network,imageTag
        })
    })
//    TODO:server error - Could not attach to network TeekingNetwork: rpc error: code = NotFound desc = network TeekingNetwork not found

})


