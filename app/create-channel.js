const fs = require('fs');
const helper = require('./helper.js');
const logger = require('./util/logger').new('create-Channel');
const multiSign = require('./util/multiSign').signs;
const Sleep = require('sleep');
const OrdererUtil = require('./util/orderer');
/**
 *
 * @param client client of committer
 * @param channelName
 * @param channelConfigFile
 * @param {string[]} orgNames orgName array of endorsers
 * @param {string} ordererUrl such like 'grpc://localhost:7050'; if not specified, we will use channel.getOrderers()[0]
 * @returns {PromiseLike<T> | Promise<T>}
 */
const createChannel = (client, channelName, channelConfigFile, orgNames, ordererUrl) => {
    logger.debug('====== Creating Channel ======');
    logger.debug({channelName, channelConfigFile, orgNames});


    const clientSwitchPromises = [];
    for (let orgName of orgNames) {
        const switchPromise = helper.getOrgAdmin(orgName);
        clientSwitchPromises.push(switchPromise);
    }
    const channelConfig_envelop = fs.readFileSync(channelConfigFile);

    // extract the channel config bytes from the envelope to be signed
    const channelConfig = client.extractChannelConfig(channelConfig_envelop);
    logger.debug({channelConfig});
    return multiSign(clientSwitchPromises, channelConfig).then(signatures => {
        const channel = helper.prepareChannel(channelName, client, true);
        const txId = client.newTransactionID();
        const orderers = channel.getOrderers();
        logger.debug(orderers.length,'orderers in channel',channelName);
        const orderer = OrdererUtil.find({orderers,ordererUrl});
        const request = {
            config: channelConfig,
            signatures,
            name: channelName.toLowerCase(),
            orderer,
            txId
        };
        logger.debug('signatures', signatures.length);
        const loopGetChannel = () => {
            logger.debug('loopGetChannel', 'try...');
            return channel.initialize().catch(err => {
                //NOTE before channel created successfully, channel.getGenesisBlock() return:Error: Invalid results returned ::NOT_FOUND
                if (err.toString().includes('Invalid results returned ::NOT_FOUND')) {
                    const wait = 100;
                    logger.warn('loopGetChannel', `wait ${wait}ms`);
                    Sleep.msleep(100);
                    return loopGetChannel();
                }
                if (err.toString().includes('Invalid results returned ::SERVICE_UNAVAILABLE') &&
                    helper.globalConfig.orderer.type === 'kafka') {
                    const wait = 100;
                    logger.warn('loopGetChannel', `wait ${wait}ms in kafka mode`);
                    Sleep.msleep(100);
                    return loopGetChannel();
                }
                return Promise.reject(err);
            });
        };
        //as in jsdoc: Note that this is not the confirmation of successful creation of the channel. The client application must poll the orderer to discover whether the channel has been created completely or not.
        return client.createChannel(request).then((results) => {
            logger.debug('channel created', results);
            return loopGetChannel().then((channelConfig) => {
                logger.info('channel initialized');
                //NOTE channel.getGenesisBlock({txId:client.newTransactionID()}) ready here
                return channelConfig;
            });

        });

    });
};

exports.create = createChannel;