const {create, joinAll, updateAnchorPeers} = require('./channelHelper');
const ChannelUtil = require('../common/nodejs/channel');
const helper = require('./helper');
const {projectResolve} = helper;
const logger = require('../common/nodejs/logger').new('channel script');
const {sleep} = require('khala-nodeutils/helper');
const path = require('path');
const channelName = 'allchannel';

const globalConfig = require('../config/orgs.json');
const {TLS} = globalConfig;
const channelConfig = globalConfig.channels[channelName];
const channelConfigFile = projectResolve(globalConfig.docker.volumes.CONFIGTX.dir, channelConfig.file);

const task = async () => {
	const peerOrg = helper.randomOrg('peer');
	const client = await helper.getOrgAdmin(peerOrg);
	const channel = helper.prepareChannel(channelName, client);
	const orderers = await ChannelUtil.getOrderers(channel, true);
	const orderer = orderers[0];
	try {
		await create(channel, channelConfigFile, orderer);
	} catch (err) {
		if (err.toString().includes('Error: BAD_REQUEST') ||
			(err.status && err.status.includes('BAD_REQUEST'))) {
			// TODO existing swallow, inspect error here
			logger.warn('create-channel', err);
		} else {
			throw err;
		}
	}
	await joinAll(channelName);

	await sleep(1000);
	for (const org in channelConfig.orgs) {
		await updateAnchorPeers(path.resolve(__dirname, '../config/configtx.yaml'), channelName, org);
		await sleep(1000);// TODO wait block to broadcast
	}
};


task();





