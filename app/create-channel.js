const fs = require('fs');
const helper = require('./helper.js');
const logger = require('./util/logger').new('create-Channel');
const multiSign = require('./util/multiSign').signs;
const Sleep = require('sleep');
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
        const orderer = ordererUrl ? orderers.find((orderer) => {
            logger.debug(orderer.getUrl(),ordererUrl)
            return orderer.getUrl() === ordererUrl;
        }) : orderers[0];
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
        //NOTE before channel created, channel.getGenesisBlock() return:Error: Invalid results returned ::NOT_FOUND
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