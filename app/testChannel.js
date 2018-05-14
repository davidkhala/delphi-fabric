const createChannel = require('./create-channel').create;
const {joinChannel} = require('./join-channel');

const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('testChannel');
const channelName = 'allchannel';

const companyConfig = require('../config/orgs.json');
const channelConfig = companyConfig.channels[channelName];
const channelConfigFile = `${companyConfig.docker.volumes.CONFIGTX.dir}/${channelConfig.file}`;
const joinAllfcn = async () => {


	for (const orgName in  channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		const client = await helper.getOrgAdmin(orgName);

		const channel = helper.prepareChannel(channelName, client);
		const loopJoinChannel = async () => {
			try{
				return await joinChannel(channel, peers)
			}catch (err) {
				if (err.toString().includes('Invalid results returned ::NOT_FOUND')
					|| err.toString().includes('SERVICE_UNAVAILABLE')) {
					logger.warn('loopJoinChannel...');
					await new Promise(resolve => {
						setTimeout(()=>{
							resolve(loopJoinChannel())
						},1000)
					});
				}
				else throw err;
			}
		};
		await loopJoinChannel();

	}

};
//E0905 10:07:20.462272826    7262 ssl_transport_security.c:947] Handshake failed with fatal error SSL_ERROR_SSL: error:14090086:SSL routines:ssl3_get_server_certificate:certificate verify failed.

helper.getOrgAdmin('BU.Delphi.com').then((client) => {
	return createChannel(client, channelName, channelConfigFile, ['BU.Delphi.com', 'ENG.Delphi.com'], 'grpc://localhost:7050');
}).then(() => {
	return joinAllfcn();
}).catch(err => {
	if (err.toString().includes('Error: BAD_REQUEST') ||
		(err.status && err.status.includes('BAD_REQUEST'))) {
		//existing swallow
		return joinAllfcn();
	} else {
		return Promise.reject(err);
	}
}).then((data) => {
	logger.info('final success', data);

});



