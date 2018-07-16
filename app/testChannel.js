const {create: createChannel} = require('./channelHelper');
const {join: joinChannel} = require('../common/nodejs/channel');

const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('testChannel');
const configtxlator = require('../common/nodejs/configtxlator');
const {homeResolve,fsExtra} = require('../common/nodejs/path');
const channelName = 'allchannel';

const globalConfig = require('../config/orgs.json');
const {TLS} = globalConfig;
const channelConfig = globalConfig.channels[channelName];

const channelConfigFile = homeResolve(globalConfig.docker.volumes.CONFIGTX.dir, channelConfig.file);
const joinAllfcn = async (channelName) => {


	for (const orgName in  channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		const client = await helper.getOrgAdmin(orgName);

		const channel = helper.prepareChannel(channelName, client);
		for (const peer of peers) {
			const eventHub = await peer.eventHubPromise;

			const loopJoinChannel = async () => {
				try {
					return await joinChannel(channel, peer, eventHub);
				} catch (err) {
					if (err.toString().includes('Invalid results returned ::NOT_FOUND')
						|| err.toString().includes('UNAVAILABLE')) {
						logger.warn('loopJoinChannel...');
						await new Promise(resolve => {
							setTimeout(() => {
								resolve(loopJoinChannel());
							}, 1000);
						});
					}
					else throw err;
				}
			};
			await loopJoinChannel();
		}
	}

};
const task = async () => {
	const ordererOrg = helper.randomOrg('orderer');
	const {portHost: ordererHostPort} = helper.findOrgConfig(ordererOrg);
	const client = await helper.getOrgAdmin(ordererOrg, 'orderer');
	const ordererUrl = `${TLS ? 'grpcs' : 'grpc'}://localhost:${ordererHostPort}`;
	const peerOrg = helper.randomOrg('peer');
	logger.info({ordererUrl, peerOrg});
	try {
		await createChannel(client, channelName, channelConfigFile, [peerOrg], ordererUrl);
		await joinAllfcn(channelName);
	} catch (err) {
		if (err.toString().includes('Error: BAD_REQUEST') ||
			(err.status && err.status.includes('BAD_REQUEST'))) {
			//existing swallow
			await joinAllfcn(channelName);
		} else throw err;
	}
	const peerClient = await helper.getOrgAdmin(undefined, 'peer'); //only peer user can read channel
	try {
		const channel = helper.prepareChannel(channelName, peerClient);
		const {original_config} = await configtxlator.getChannelConfigReadable(channel);

		fsExtra.outputFileSync(`${channelName}.json`, original_config);
	} catch (e) {
		logger.error(e);
	}
	try {
		const channel = helper.prepareChannel(undefined, client);
		const {original_config} = await configtxlator.getChannelConfigReadable(channel, 'orderer');

		fsExtra.outputFileSync('testchainid.json', original_config);
	} catch (e) {
		logger.error(e);
	}

};
task();




