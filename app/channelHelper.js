const helper = require('./helper.js');
const logger = require('../common/nodejs/logger').new('create-Channel');
const OrdererUtil = require('../common/nodejs/orderer');
const channelUtil = require('../common/nodejs/channel');

/**
 *
 * @param client client of committer
 * @param channelName
 * @param channelConfigFile
 * @param {string[]} orgNames orgName array of endorsers
 * @param {string} ordererUrl such like 'grpc://localhost:7050'; if not specified, we will use channel.getOrderers()[0]
 * @returns {PromiseLike<T> | Promise<T>}
 */
exports.create = async (client, channelName, channelConfigFile, orgNames, ordererUrl) => {
	logger.debug('Create Channel',{channelName, channelConfigFile, orgNames});

	channelUtil.nameMatcher(channelName, true);

	const clientSwitchPromises = [];
	for (const orgName of orgNames) {
		const switchPromise = helper.getOrgAdmin(orgName);
		clientSwitchPromises.push(switchPromise);
	}

	// extract the channel config bytes from the envelope to be signed
	const channel = helper.prepareChannel(channelName, client, true);
	const orderers = channel.getOrderers();
	logger.debug(orderers.length, 'orderers in channel', channelName);
	const orderer = OrdererUtil.find({orderers, ordererUrl});

	return channelUtil.create(clientSwitchPromises, channel, channelConfigFile, orderer);
};
