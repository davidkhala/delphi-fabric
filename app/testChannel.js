const createChannel = require('./create-channel').create;
const joinChannel = require('./join-channel').joinChannel;
const ClientUtil = require('./util/client');

const helper = require('./helper');
const logger = require('./util/logger').new('testChannel');
const channelName = 'delphiChannel';

const company = helper.helperConfig.COMPANY;
const companyConfig = helper.helperConfig[company];
const channelConfig = companyConfig.channels[channelName];
const channelConfigFile = `${companyConfig.docker.volumes.CONFIGTX.dir}/${channelConfig.file}`;
const joinAllfcn = () => {

    let promise = Promise.resolve();

    for (let orgName in  channelConfig.orgs) {
        const {peerIndexes} = channelConfig.orgs[orgName];
        const peers = helper.newPeers(peerIndexes, orgName);

        promise = promise.then(() => helper.getOrgAdmin(orgName, ClientUtil.new())).then((client) => {

            const channel = helper.prepareChannel(channelName, client);
            return joinChannel(channel, peers);
        });
    }

    return promise;
};
//E0905 10:07:20.462272826    7262 ssl_transport_security.c:947] Handshake failed with fatal error SSL_ERROR_SSL: error:14090086:SSL routines:ssl3_get_server_certificate:certificate verify failed.

createChannel(channelName, channelConfigFile, ['BU', 'PM']).then(() => {
    return joinAllfcn();
}).catch(err => {
    if (err.toString().includes('Error: BAD_REQUEST')) {
        //existing swallow
        return joinAllfcn();
    } else {
        return Promise.reject(err);
    }
}).catch((err) => {
    logger.error('joinChannel Error', err);
    return Promise.reject(err);
});


