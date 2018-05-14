const fs = require('fs');
const helper = require('./helper.js');
const logger = require('../common/nodejs/logger').new('create-Channel');
const multiSign = require('../common/nodejs/multiSign').signs;
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
exports.createChannel = async (client, channelName, channelConfigFile, orgNames, ordererUrl) => {
	logger.debug('====== Creating Channel ======');
	logger.debug({channelName, channelConfigFile, orgNames});

	channelUtil.nameMatcher(channelName, true);

	const clientSwitchPromises = [];
	for (const orgName of orgNames) {
		const switchPromise = helper.getOrgAdmin(orgName);
		clientSwitchPromises.push(switchPromise);
	}
	const channelConfig_envelop = fs.readFileSync(channelConfigFile);

	// extract the channel config bytes from the envelope to be signed
	const channelConfig = client.extractChannelConfig(channelConfig_envelop);
	logger.debug({channelConfig});
	const {signatures} = await multiSign(clientSwitchPromises, channelConfig);
	const channel = helper.prepareChannel(channelName, client, true);
	const txId = client.newTransactionID();
	const orderers = channel.getOrderers();
	logger.debug(orderers.length, 'orderers in channel', channelName);
	const orderer = OrdererUtil.find({orderers, ordererUrl});
	const request = {
		config: channelConfig,
		signatures,
		name: channelName,
		orderer,
		txId
	};
	logger.debug('signatures', signatures.length);

	//as in jsdoc: Note that this is not the confirmation of successful creation of the channel. The client application must poll the orderer to discover whether the channel has been created completely or not.
	const results = await client.createChannel(request);
	logger.debug('channel created', results);
	const {status, info} = results;
	if (status === 'SUCCESS') return results;
	else throw results;

};
