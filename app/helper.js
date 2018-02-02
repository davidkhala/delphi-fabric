/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';

const logger = require('./util/logger').new('Helper');
const path = require('path');
const fs = require('fs-extra');
const caUtil = require('./util/ca');
const globalConfig = require('../config/orgs.json');

const companyConfig = globalConfig;
const orgsConfig = companyConfig.orgs;
const CRYPTO_CONFIG_DIR = companyConfig.docker.volumes.MSPROOT.dir;
const channelsConfig = companyConfig.channels;
const COMPANY_DOMAIN = companyConfig.domain;
const chaincodeConfig = require('../config/chaincode.json');
const Client = require('fabric-client');
const sdkUtils = require('fabric-client/lib/utils');
const nodeConfig = require('./config.json');
const ClientUtil = require('./util/client');
const EventHubUtil = require('./util/eventHub');
const Orderer = require('fabric-client/lib/Orderer');

// set up the client and channel objects for each org
const GPRC_protocol = companyConfig.TLS ? 'grpcs://' : 'grpc://';  // FIXME: assume using TLS
const gen_tls_cacerts = (orgName, peerIndex) => {
    const org_domain = `${orgName}.${COMPANY_DOMAIN}`;// bu.delphi.com
    const peer_hostName_full = `peer${peerIndex}.${org_domain}`;
    const tls_cacerts = `${CRYPTO_CONFIG_DIR}/peerOrganizations/${org_domain}/peers/${peer_hostName_full}/tls/ca.crt`;
    return {org_domain, peer_hostName_full, tls_cacerts};
};
const newPeer = ({peerPort, tls_cacerts, peer_hostName_full}) => {
    if (companyConfig.TLS) {
        return require('./util/peer').new({peerPort, tls_cacerts, peer_hostName_full});
    } else {
        return require('./util/peer').new({peerPort, peer_hostName_full});
    }
};

// peerConfig: "portMap": [{	"host": 8051,		"container": 7051},{	"host": 8053,		"container": 7053}]
const preparePeer = (orgName, peerIndex, peerConfig) => {
    const {peer_hostName_full, tls_cacerts} = gen_tls_cacerts(orgName, peerIndex);
    let peerPort;
    let eventHubPort;
    for (let portMapEach of peerConfig.portMap) {
        if (portMapEach.container === 7051) {
            peerPort = portMapEach.host;
        }
        if (portMapEach.container === 7053) {
            eventHubPort = portMapEach.host;
        }
    }
    if (!peerPort) {
        logger.warn(`Could not find port mapped to 7051 for peer host==${peer_hostName_full}`);
        throw new Error(`Could not find port mapped to 7051 for peer host==${peer_hostName_full}`);
    }
    const peer = newPeer({peerPort, tls_cacerts, peer_hostName_full});
    //NOTE append more info
    peer.peerConfig = peerConfig;

    peer.peerConfig.eventHub = {
        port: eventHubPort,
        clientPromise: objects.user.admin.select(orgName, ClientUtil.new()),
    };
    peer.peerConfig.orgName = orgName;
    peer.peerConfig.peerIndex = peerIndex;
    return peer;
};

const ordererConfig = companyConfig.orderer;

/**
 * FIXME assume we have only one orderer

 * @param client
 * @param channelName
 * @param isRenew
 */
exports.prepareChannel = (channelName, client, isRenew) => {

    const channelConfig = channelsConfig[channelName];
    const channelname = channelName.toLowerCase();

    if (isRenew) {
        delete client._channels[channelname];
    } else {
        if (client._channels[channelname]) return client._channels[channelname];
    }

    const channel = client.newChannel(channelname);//NOTE throw exception if exist
    const newOrderer = (ordererName,ordererSingleConfig)=>{
        const orderer_url = `${GPRC_protocol}localhost:${ordererSingleConfig.portMap[7050]}`;
        let orderer
        if(companyConfig.TLS){
            const orderer_hostName_full = `${ordererName}.${COMPANY_DOMAIN}`;
            const orderer_tls_cacerts = path.resolve(CRYPTO_CONFIG_DIR,
                'ordererOrganizations', COMPANY_DOMAIN, 'orderers', orderer_hostName_full, 'tls', 'ca.crt');
            orderer = new Orderer(orderer_url, {
                pem: fs.readFileSync(orderer_tls_cacerts).toString(),
                'ssl-target-name-override': orderer_hostName_full,
            });
        }else {
            orderer = new Orderer(orderer_url);
        }
        return orderer
    }
    if(ordererConfig.type==='kafka'){
        const ordererConfigs = ordererConfig.kafka.orderers;
        for(let ordererName in ordererConfigs){
            const ordererSingleConfig =ordererConfigs[orderer];
            newOrderer(ordererName,ordererSingleConfig)
            channel.addOrderer(orderer);
        }

    }else {
        newOrderer(ordererConfig.solo.container_name,ordererConfig.solo)
        channel.addOrderer(orderer);
    }

    for (let orgName in channelConfig.orgs) {
        const orgConfigInChannel = channelConfig.orgs[orgName];
        for (let peerIndex of orgConfigInChannel.peerIndexes) {
            const peerConfig = orgsConfig[orgName].peers[peerIndex];

            const peer = preparePeer(orgName, peerIndex, peerConfig);
            channel.addPeer(peer);

        }
    }
    channel.eventWaitTime = channelsConfig[channelName].eventWaitTime;
    channel.orgs = channelsConfig[channelName].orgs;
    return channel;
};

const getStateDBCachePath = () => {
//state DB is designed for caching heavy-weight User object,
// client.getUserContext() will first query existence in cache first
    return nodeConfig.stateDBCacheDir;
};

const preparePeers = (peerIndexes, orgName) => {

// work as a data adapter, containerNames: array --> orgname,peerIndex,peerConfig for each newPeer
    const targets = [];
    // find the peer that match the urls
    for (let index of peerIndexes) {

        const peerConfig = orgsConfig[orgName].peers[index];
        if (!peerConfig) continue;
        const peer = preparePeer(orgName, index, peerConfig);
        targets.push(peer);
    }
    return targets;

};

const bindEventHub = (richPeer, client) => {
    // NOTE newEventHub binds to clientContext, eventhub error { Error: event message must be properly signed by an identity from the same organization as the peer: [failed deserializing event creator: [Expected MSP ID PMMSP, received BUMSP]]

    const eventHubPort = richPeer.peerConfig.eventHub.port;
    const pem = richPeer.pem;
    const peer_hostName_full = richPeer._options['grpc.ssl_target_name_override'];
    return EventHubUtil.new(client, {eventHubPort, pem, peer_hostName_full});

};
/**
 * NOTE just static getter
 * @param orgName
 */
const getMspID = (orgName) => {

    const mspid = orgsConfig[orgName].MSP.id;
    return mspid;
};
//NOTE have to do this since filename for private Key file would be as : a4fbafa51de1161a2f82ffa80cf1c34308482c33a9dcd4d150183183d0a3e0c6_sk
const getKeyFilesInDir = (dir) => {
    const files = fs.readdirSync(dir);
    return files.filter((fileName) => fileName.endsWith('_sk')).map((fileName) => path.resolve(dir, fileName));
};

const rawAdminUsername = 'adminName';
const objects = {};

objects.user = {
    clear: (client) => {
        client._userContext = null;
        client.setCryptoSuite(null);
    },
    tlsCreate: (tlsDir, username, orgName, mspid = getMspID(orgName), skipPersistence = false, client) => {
        const privateKey = path.join(tlsDir, 'server.key');
        const signedCert = path.join(tlsDir, 'server.crt');
        const createUserOpt = {
            username: formatUsername(username, orgName),
            mspid,
            cryptoContent: {privateKey, signedCert},
            skipPersistence,
        };
        if (skipPersistence) {
            return client.createUser(createUserOpt);
        } else {
            return sdkUtils.newKeyValueStore({
                path: getStateDBCachePath(orgName),
            }).then((store) => {
                client.setStateStore(store);
                return client.createUser(createUserOpt);
            });
        }
    },
    mspCreate: (client,
                {keystoreDir, signcertFile, username, orgName, mspid = getMspID(orgName), skipPersistence = false}) => {
        const keyFile = getKeyFilesInDir(keystoreDir)[0];
        // NOTE:(jsdoc) This allows applications to use pre-existing crypto materials (private keys and certificates) to construct user objects with signing capabilities
        // NOTE In client.createUser option, two types of cryptoContent is supported:
        // 1. cryptoContent: {		privateKey: keyFilePath,signedCert: certFilePath}
        // 2. cryptoContent: {		privateKeyPEM: keyFileContent,signedCertPEM: certFileContent}

        const createUserOpt = {
            username: formatUsername(username, orgName),
            mspid,
            cryptoContent: {privateKey: keyFile, signedCert: signcertFile},
            skipPersistence,
        };
        if (skipPersistence) {
            return client.createUser(createUserOpt);
        } else {
            return sdkUtils.newKeyValueStore({
                path: getStateDBCachePath(orgName),
            }).then((store) => {
                client.setStateStore(store);
                return client.createUser(createUserOpt);
            });
        }
    },
    /**
     * search in stateStore first, if not exist, then query state db to get cached user object
     * @param username
     * @param orgName
     * @param client
     * @return {Promise.<TResult>}
     */
    get: (username, orgName, client) => {
        const newKVS = () => sdkUtils.newKeyValueStore({
            path: getStateDBCachePath(orgName),
        }).then((store) => {
            client.setStateStore(store);
            return client.getUserContext(formatUsername(username, orgName), true);
        });
        if (client.getStateStore()) {
            return client.loadUserFromStateStore(formatUsername(username, orgName)).then(user => {
                if (user) return user;
                return newKVS();
            });
        } else {
            return newKVS();
        }
    },
    createIfNotExist: (keystoreDir, signcertFile, username, orgName, client) =>
        objects.user.get(username, orgName, client).then(user => {
            if (user) return client.setUserContext(user, false);
            return objects.user.mspCreate(client, {keystoreDir, signcertFile, username, orgName});
        }),
    select: (keystoreDir, signcertFile, username, orgName, client) => {
        objects.user.clear(client);
        return objects.user.createIfNotExist(keystoreDir, signcertFile, username, orgName, client);
    },

};
exports.formatPeerName = (peerName, orgName) => `${peerName}.${orgName}.${COMPANY_DOMAIN}`;
const formatUsername = (username, orgName) => `${username}@${orgName}.${COMPANY_DOMAIN}`;

objects.user.admin = {
    orderer: {
        select: (client, ordererContainerName = 'ordererContainerName') => {

            const rawOrdererUsername = 'ordererAdminName';

            const keystoreDir = path.join(CRYPTO_CONFIG_DIR,
                'ordererOrganizations', COMPANY_DOMAIN, 'users', `Admin@${COMPANY_DOMAIN}`, 'msp', 'keystore');
            const signcertFile = path.join(CRYPTO_CONFIG_DIR,
                'ordererOrganizations', COMPANY_DOMAIN, 'users', `Admin@${COMPANY_DOMAIN}`, 'msp', 'signcerts',
                `Admin@${COMPANY_DOMAIN}-cert.pem`);
            const ordererMSPID = ordererConfig.MSP.id;
            objects.user.clear(client);

            return objects.user.get(rawOrdererUsername, ordererContainerName, client).then(user => {
                if (user) return client.setUserContext(user, false);
                return objects.user.mspCreate(client, {
                    keystoreDir, signcertFile, username: rawOrdererUsername, orgName: ordererContainerName,
                    mspid: ordererMSPID,
                });
            });
        },
    }
    ,
    get: (orgName, client) => objects.user.get(rawAdminUsername, orgName, client),
    create: (orgName, client) => {

        const org_domain = `${orgName}.${COMPANY_DOMAIN}`;// BU.Delphi.com
        const keystoreDir = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations', org_domain, 'users', `Admin@${org_domain}`,
            'msp', 'keystore');

        const signcertFile = path.join(CRYPTO_CONFIG_DIR,
            'peerOrganizations', org_domain, 'users', `Admin@${org_domain}`, 'msp', 'signcerts',
            `Admin@${org_domain}-cert.pem`);

        return objects.user.mspCreate(client, {keystoreDir, signcertFile, username: rawAdminUsername, orgName});
    },
    createIfNotExist: (orgName, client) => objects.user.admin.get(orgName, client).then(user => {
        if (user) return client.setUserContext(user, false);
        return objects.user.admin.create(orgName, client);
    }),
    select: (orgName, client) => {
        objects.user.clear(client);
        return objects.user.admin.createIfNotExist(orgName, client).then(() => Promise.resolve(client));
    },
};

// TODO: TypeError: Path must be a string. Received undefined
exports.setGOPATH = () => {
    process.env.GOPATH = chaincodeConfig.GOPATH;
};

exports.chaincodeProposalAdapter = (actionString, validator) => {
    const _validator = validator ? validator : ({response}) => {
        return {isValid: response && response.status === 200, isSwallowed: false};
    };
    return ([responses, proposal, header]) => {

        let errCounter = 0; // NOTE logic: reject only when all bad
        let swallowCounter = 0;
        for (let i in responses) {
            const proposalResponse = responses[i];
            const {isValid, isSwallowed} = _validator(proposalResponse);
            if (isValid) {
                logger.info(`${actionString} was good for [${i}]`, proposalResponse);
                if (isSwallowed) {
                    swallowCounter++;
                }
            } else {
                logger.error(`${actionString} was bad for [${i}]`, proposalResponse);
                errCounter++;
            }
        }

        return Promise.resolve({
            errCounter,
            swallowCounter,
            nextRequest: {
                proposalResponses: responses, proposal,
            },
        });

    };
};

exports.helperConfig = Object.assign({}, {GPRC_protocol}, globalConfig);
exports.gen_tls_cacerts = gen_tls_cacerts;
exports.preparePeer = preparePeer;
exports.newPeer = newPeer;
exports.newPeers = preparePeers;
exports.userAction = objects.user;
exports.bindEventHub = bindEventHub;
exports.getOrgAdmin = objects.user.admin.select;
exports.formatUsername = formatUsername;
exports.findKeyfiles = getKeyFilesInDir;