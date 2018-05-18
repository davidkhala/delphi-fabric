const {createChannel} = require('./create-channel');
const {joinChannel} = require('./join-channel');

const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('testChannel');
const channelName = 'allchannel';

const globalConfig = require('../config/orgs.json');
const {TLS}= globalConfig;
const channelConfig = globalConfig.channels[channelName];

const channelConfigFile = `${globalConfig.docker.volumes.CONFIGTX.dir}/${channelConfig.file}`;
const joinAllfcn = async () => {


	for (const orgName in  channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		const client = await helper.getOrgAdmin(orgName);

		const channel = helper.prepareChannel(channelName, client);
		const loopJoinChannel = async () => {
			try{
				return await joinChannel(channel, peers);
			}catch (err) {
				if (err.toString().includes('Invalid results returned ::NOT_FOUND')
					|| err.toString().includes('SERVICE_UNAVAILABLE')) {
					logger.warn('loopJoinChannel...');
					await new Promise(resolve => {
						setTimeout(()=>{
							resolve(loopJoinChannel());
						},1000);
					});
				}
				else throw err;
			}
		};
		await loopJoinChannel();

	}

};

helper.getOrgAdmin('BU.Delphi.com').then((client) => {
	const ordererUrl = `${TLS?'grpcs':'grpc'}://localhost:7050`;
	logger.info({ordererUrl});
	return createChannel(client, channelName, channelConfigFile, ['BU.Delphi.com', 'ENG.Delphi.com'], ordererUrl);
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



