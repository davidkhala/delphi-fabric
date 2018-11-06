const {create: createChannel} = require('./channelHelper');
const {join: joinChannel, updateAnchorPeers} = require('../common/nodejs/channel');

const helper = require('./helper');
const {projectResolve} = helper;
const logger = require('../common/nodejs/logger').new('testChannel');
const configtxlator = require('../common/nodejs/configtxlator');
const EventHubUtil = require('../common/nodejs/eventHub');
const {fsExtra} = require('../common/nodejs/path');
const {exec} = require('khala-nodeutils/helper');
const path = require('path');
const channelName = 'allchannel';

const globalConfig = require('../config/orgs.json');
const {TLS} = globalConfig;
const channelConfig = globalConfig.channels[channelName];

const channelConfigFile = projectResolve(globalConfig.docker.volumes.CONFIGTX.dir, channelConfig.file);
const joinAllfcn = async (channelName) => {


	for (const orgName in channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		const client = await helper.getOrgAdmin(orgName);

		const channel = helper.prepareChannel(channelName, client);
		for (const peer of peers) {

			const loopJoinChannel = async () => {
				try {
					return await joinChannel(channel, peer);
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
	const ordererClient = await helper.getOrgAdmin(ordererOrg, 'orderer');
	const ordererUrl = `${TLS ? 'grpcs' : 'grpc'}://localhost:${ordererHostPort}`;
	const peerOrg = helper.randomOrg('peer');
	logger.info({ordererUrl, peerOrg});
	try {
		await createChannel(ordererClient, channelName, channelConfigFile, [peerOrg], ordererUrl);
		await joinAllfcn(channelName);
		await anchorPeersUpdate(path.resolve(__dirname, '../config/configtx.yaml'), channelName, 'ASTRI.org');
	} catch (err) {
		if (err.toString().includes('Error: BAD_REQUEST') ||
			(err.status && err.status.includes('BAD_REQUEST'))) {
			//existing swallow
			await joinAllfcn(channelName);
		} else throw err;
	}

	try {
		const peerClient = await helper.getOrgAdmin(undefined, 'peer'); //only peer user can read channel
		const channel = helper.prepareChannel(channelName, peerClient);
		const peer = channel.getPeers()[0];
		const {original_config} = await configtxlator.getChannelConfigReadable(channel, peer);

		fsExtra.outputFileSync(`${channelName}.json`, original_config);
	} catch (e) {
		logger.error(e);
	}
	try {
		const channel = helper.prepareChannel(undefined, ordererClient);
		const {original_config} = await configtxlator.getChannelConfigReadable(channel);

		fsExtra.outputFileSync('testchainid.json', original_config);
	} catch (e) {
		logger.error(e);
	}

};
const anchorPeersUpdate = async (configtxYaml, channelName, orgName) => {
	const anchorTx = path.resolve(`${orgName}Anchors.tx`);
	const config_dir = path.dirname(configtxYaml);
	const runConfigtxGenShell = path.resolve(__dirname, '../common/bin-manage/runConfigtxgen.sh');
	const PROFILE = 'anchorPeers';
	await exec(`export FABRIC_CFG_PATH=${config_dir} && ${runConfigtxGenShell} genAnchorPeers ${anchorTx} ${PROFILE} ${channelName} ${orgName}`);

	const client = await helper.getOrgAdmin(orgName);

	const channel = helper.prepareChannel(channelName, client);
	const orderer = channel.getOrderers()[0];

	await updateAnchorPeers(channel, anchorTx, orderer);

	const peer = helper.newPeers([0], orgName)[0];
	const eventHub = EventHubUtil.newEventHub(channel, peer, true);
	const block = await EventHubUtil.BlockWaiter(eventHub, 1);
};

task();





