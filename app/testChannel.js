const createChannel = require('./create-channel').create;
const joinChannel = require('./join-channel').joinChannel;

const helper = require('./helper');
const logger = require('./util/logger').new('testChannel');
const channelName = 'allChannel';
const Sleep = require('sleep');

const companyConfig = require('../config/orgs.json');
const channelConfig = companyConfig.channels[channelName];
const channelConfigFile = `${companyConfig.docker.volumes.CONFIGTX.dir}/${channelConfig.file}`;
const joinAllfcn = () => {

	let promise = Promise.resolve();

	for (const orgName in  channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		promise = promise.then(() => helper.getOrgAdmin(orgName)).then((client) => {

			const channel = helper.prepareChannel(channelName, client);
			const loopJoinChannel = ()=>{
				return joinChannel(channel, peers).catch(err=>{
					const errString = err.toString();
					if(errString.includes('Invalid results returned ::NOT_FOUND')
						||errString.includes('SERVICE_UNAVAILABLE')){
						logger.warn('loopJoinChannel...');
						Sleep.msleep(1000);
						return loopJoinChannel();
					}
					else return Promise.reject(err);
				});
			};
			return loopJoinChannel();

		});
	}

	return promise;
};
//E0905 10:07:20.462272826    7262 ssl_transport_security.c:947] Handshake failed with fatal error SSL_ERROR_SSL: error:14090086:SSL routines:ssl3_get_server_certificate:certificate verify failed.

helper.getOrgAdmin('TK').then((client) => {
	return createChannel(client, channelName, channelConfigFile, ['TK', 'SUPPLY'], 'grpc://localhost:7050');
}).then(() => {
	return joinAllfcn();
}).catch(err => {
	if (err.toString().includes('Error: BAD_REQUEST')||
		err.status.includes('BAD_REQUEST')) {
		//existing swallow
		return joinAllfcn();
	} else {
		return Promise.reject(err);
	}
}).then((data)=>{
	logger.info('final success',data);

}).catch((err) => {
	logger.error('final Error', err);
	return Promise.reject(err);
});



