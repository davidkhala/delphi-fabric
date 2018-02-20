const requestPromise = require('request-promise-native');
const logger = require('../app/util/logger').new('swarmServerClient');
const requestBuilder = ({uri, body}) => {
    return {
        method: 'POST',
        uri,
        body,
        json: true
    };
};
exports.manager = {
    join: (serverBaseUrl, {ip, hostname}) => {
        logger.info('managerJoin', {serverBaseUrl, ip, hostname});
        requestPromise(requestBuilder({
            uri: `${serverBaseUrl}/manager/join`,
            body: {ip, hostname}
        })).then(result => {
            logger.debug(result);
        });
    },
    leave: (serverBaseUrl, {ip}) => {
        logger.info('managerLeave', {serverBaseUrl, ip});
        requestPromise(requestBuilder({
            uri: `${serverBaseUrl}/manager/leave`,
            body: {ip}
        })).then(result => {
            logger.debug(result);
        });
    }


};

