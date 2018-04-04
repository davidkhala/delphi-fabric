const logger = require('./app/util/logger').new('express API');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const path = require('path');
const fs = require('fs');
const app = express();
const cors = require('cors');
const {host, port} = require('./app/config.json');
const companyConfig = require('./config/orgs.json');
const channelsConfig = companyConfig.channels;
const chaincodesConfig = require('./config/chaincode.json');
const CONFIGTXDir = companyConfig.docker.volumes.CONFIGTX.dir;

const wsCommon = require('./express/webSocketCommon');
const helper = require('./app/helper.js');
const createChannel = require('./app/create-channel').create;
const joinChannel = require('./app/join-channel').joinChannel;

const Query = require('./app/query');
const {install} = require('./app/install-chaincode.js');

app.options('*', cors());
app.use(cors());
//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use('/config', require('./express/configExpose'));

app.get('/', (req, res, next) => {
    res.send('pong from davids server')
});

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
const server = http.createServer(app).listen(port, function () {
});
logger.info('****************** SERVER STARTED ************************');
logger.info(`**************  http://${host}:${port}    ******************`);
server.timeout = 240000;

const WebSocket = require('ws');
const ws = new WebSocket.Server({server});

ws.on('connection', (ws, req) => {
    const url = require('url');


    const location = url.parse(req.url, true);

    const pathSplit = location.path.split('/');
    logger.debug('onConnect', pathSplit);
    let messageCB = (message) => {
        logger.debug('received: %s', message);
        wsCommon.pong(ws, (err) => {
            logger.error(err)
        })
    };
    const {errorHandle} = wsCommon;

    if (pathSplit.length === 4) {
        switch (pathSplit[1]) {
            case 'chaincode':
                const chaincodeId = pathSplit[3];
                const invalidChaincodeId = invalid.chaincodeId({chaincodeId});
                if (invalidChaincodeId) return errorHandle(invalidChaincodeId, ws);
                switch (pathSplit[2]) {
                    case 'invoke':
                        messageCB = require('./express/ws-chaincode').invoke({chaincodeId}, ws);
                        break;
                    case 'instantiate':
                        messageCB = require('./express/ws-chaincode').instantiate({chaincodeId}, ws);
                        break;
                    case 'upgrade':
                        messageCB = require('./express/ws-chaincode').upgrade({chaincodeId}, ws);
                        break;
                    default:

                }
                break;
            default:
        }
    }

    ws.on('message', messageCB)

});
app.use('/chaincode', require('./express/http-chaincode'));
app.use('/hash',require('./express/hashFile'));


const invalid = require('./express/formValid').invalid();
const errorCodeMap = require('./express/errorCodeMap.json');
const errorSyntaxHandle = (err, res) => {
    let status = 500;
    for (let errorMessage in errorCodeMap) {
        if (err.toString().includes(errorMessage)) {
            status = errorCodeMap[errorMessage];
            break
        }
    }
    res.status(status);
    res.send(err.toString())
};

// Create Channel
app.post('/channel/create/:channelName', (req, res) => {

    logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
    const {channelName} = req.params;
    const {orgName} = req.body;

    const invalidChannelName = invalid.channelName({channelName});
    if (invalidChannelName) {
        res.send(invalidChannelName);
        return
    }
    const invalidOrgName = invalid.orgName({orgName});
    if (invalidOrgName) {
        res.send(invalidOrgName);
        return
    }
    const channelFileName = channelsConfig[channelName].file;
    const channelConfigFile = path.resolve(CONFIGTXDir, channelFileName);
    logger.debug({orgName, channelName, channelConfigFile});

    if (!fs.existsSync(channelConfigFile)) {
        res.json(getErrorMessage(`channelConfigFile ${channelConfigFile} not exist`));
        return
    }

    helper.getOrgAdmin(orgName).then((client) => createChannel(client, channelName, channelConfigFile, [orgName]).then((message) => {
        res.send(`channel ${channelName} created successfully by ${orgName} with configuration in ${channelConfigFile}`)
    })).catch(err => {
        logger.error(err);
        errorSyntaxHandle(err, res)
    })
});
// Join Channel
app.post('/channel/join/:channelName', (req, res) => {
    logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
    const {channelName} = req.params;

    const invalidChannelName = invalid.channelName({channelName});
    if (invalidChannelName) {
        res.send(invalidChannelName);
        return
    }

    const {orgName, peerIndex} = req.body;
    logger.debug({channelName, orgName, peerIndex});

    const invalidPeer = invalid.peer({orgName, peerIndex});
    if (invalidPeer) {
        res.send(invalidPeer);
        return
    }

    const peers = helper.newPeers([peerIndex], orgName);


    helper.getOrgAdmin(orgName).then((client) => {
        const channel = helper.prepareChannel(channelName, client);
        return joinChannel(channel, peers).then((message) => {
            res.send(`peer${peerIndex}.${orgName} has joined channel ${channelName} successfully`)
        })
    }).catch(err => {
        errorSyntaxHandle(err, res)
    })

});
// Install chaincode on target peers
app.post('/chaincode/install/:chaincodeId', (req, res) => {
    logger.debug('==================== INSTALL CHAINCODE ==================');
    const {chaincodeId} = req.params;
    const {peerIndex, chaincodeVersion, orgName} = req.body;

    const invalidChaincodeId = invalid.chaincodeId({chaincodeId});
    if (invalidChaincodeId) {
        res.send(invalidChaincodeId);
        return
    }
    const invalidPeer = invalid.peer({orgName, peerIndex});
    if (invalidPeer) {
        res.send(invalidPeer);
        return
    }
    const chaincodeConfig = chaincodesConfig.chaincodes[chaincodeId];
    const chaincodePath = chaincodeConfig.path;

    const peers = helper.newPeers([peerIndex], orgName);
    //TODO to test ChaincodeVersion

    helper.setGOPATH();

    helper.getOrgAdmin(orgName).then((client) => {
        return install(peers, {chaincodeId, chaincodePath, chaincodeVersion}, client).then((message) => {
            res.send(
                `install chaincode ${chaincodeId} of version ${chaincodeVersion} to peer${peerIndex}.${orgName} successfully`)
        })
    })

});
//  Query Get Block by BlockNumber
app.post('/query/block/height/:blockNumber', (req, res) => {
    logger.debug('==================== GET BLOCK BY NUMBER ==================');
    const {blockNumber} = req.params;
    const {peerIndex, orgName, channelName} = req.body;

    const invalidPeer = invalid.peer({orgName, peerIndex});
    if (invalidPeer) {
        res.send(invalidPeer);
        return
    }
    logger.debug({blockNumber, peerIndex, orgName, channelName});

    helper.getOrgAdmin(orgName).then((client) => {
        const channel = helper.prepareChannel(channelName, client);
        const peer = helper.newPeers([peerIndex], orgName)[0];
        return Query.block.height(peer, channel, blockNumber).then((message) => {
            res.send(message)
        }).catch(err => {
            errorSyntaxHandle(err, res)
        })
    })

});
// Query Get Block by Hash
app.post('/query/block/hash', (req, res) => {
    logger.debug('================ GET BLOCK BY HASH ======================');
    const {hashHex, peerIndex, orgName, channelName} = req.body;
    logger.debug({hashHex, peerIndex, orgName, channelName});
    const invalidPeer = invalid.peer({orgName, peerIndex});
    if (invalidPeer) {
        res.send(invalidPeer);
        return
    }
    const peer = helper.newPeers([peerIndex], orgName)[0];
    helper.getOrgAdmin(orgName).then((client) => {
        const channel = helper.prepareChannel(channelName, client);
        return Query.block.hash(peer, channel, Buffer.from(hashHex, 'hex')).then((message) => {
            res.send(message)
        }).catch(err => {
            errorSyntaxHandle(err, res)
        })
    })

});
// Query Get Transaction by Transaction ID
app.post('/query/tx', (req, res) => {
    logger.debug('================ GET TRANSACTION BY TRANSACTION_ID ======================');
    const {txId, orgName, peerIndex, channelName} = req.body;
    logger.debug({txId, orgName, peerIndex, channelName});
    const invalidPeer = invalid.peer({orgName, peerIndex});
    if (invalidPeer) {
        res.send(invalidPeer);
        return
    }
    helper.getOrgAdmin(orgName).then((client) => {
        const channel = helper.prepareChannel(channelName, client);
        const peer = helper.newPeers([peerIndex], orgName)[0];
        return Query.tx(peer, channel, txId).then((message) => {
            res.send(message)
        }).catch(err => {
            errorSyntaxHandle(err, res)
        })
    })

});

//Query for Channel Information
//NOTE: blockchain is summary for all channel and chaincode
app.post('/query/chain', (req, res) => {
    logger.debug('================ GET blockchain INFORMATION ======================');
    const {orgName, peerIndex, channelName} = req.body;
    logger.debug({orgName, peerIndex, channelName});

    const invalidPeer = invalid.peer({orgName, peerIndex});
    if (invalidPeer) {
        res.send(invalidPeer);
        return
    }
    helper.getOrgAdmin(orgName).then((client) => {
        const channel = helper.prepareChannel(channelName, client);
        const peer = helper.newPeers([peerIndex], orgName)[0];
        return Query.chain(peer, channel).then(
            (message) => {
                const {height, currentBlockHash, previousBlockHash} = message;
                const Long = require('long');
                message.pretty = {
                    height: new Long(height.low, height.high, height.unsigned).toInt(),
                    currentBlockHash: currentBlockHash.toString('hex'),
                    previousBlockHash: previousBlockHash.toString('hex')
                };
                //npm long:to parse{ low: 4, high: 0, unsigned: true }
                res.send(message)
            }).catch(err => {
            errorSyntaxHandle(err, res)
        })
    })

});
// Query to fetch all Installed/instantiated chaincodes
app.post('/query/chaincodes/installed', (req, res) => {
    logger.debug('==================== query installed CHAINCODE ==================');
    const {orgName, peerIndex} = req.body;
    logger.debug({orgName, peerIndex});
    const invalidPeer = invalid.peer({orgName, peerIndex});
    if (invalidPeer) {
        res.send(invalidPeer);
        return
    }

    const peer = helper.newPeers([peerIndex], orgName)[0];
    helper.getOrgAdmin(orgName).then((client) => {
        return Query.chaincodes.installed(peer, client).then((message) => {
            res.send(message)
        })
    }).catch(err => {
        errorSyntaxHandle(err, res)
    })
});
app.post('/query/chaincodes/instantiated', (req, res) => {
    logger.debug('==================== query instantiated CHAINCODE ==================');
    const {orgName, peerIndex, channelName} = req.body;
    logger.debug({orgName, peerIndex, channelName});
    const invalidPeer = invalid.peer({orgName, peerIndex});
    if (invalidPeer) {
        res.send(invalidPeer);
        return
    }
    const peer = helper.newPeers([peerIndex], orgName)[0];
    helper.getOrgAdmin(orgName).then((client) => {
        const channel = helper.prepareChannel(channelName, client);
        return Query.chaincodes.instantiated(peer, channel).then((message) => {
            res.send(message)
        })
    }).catch(err => {
        errorSyntaxHandle(err, res)
    })
});
// Query to fetch channels
app.post('/query/channelJoined', (req, res) => {
    logger.debug('================ query joined CHANNELS ======================');
    const {orgName, peerIndex} = req.body;
    logger.debug({orgName, peerIndex});
    const invalidPeer = invalid.peer({orgName, peerIndex});
    if (invalidPeer) {
        res.send(invalidPeer);
        return
    }
    const peer = helper.newPeers([peerIndex], orgName)[0];
    helper.getOrgAdmin(orgName).then((client) => {
        return Query.channel.joined(peer, client).then((
            message) => {
            res.send(message)
        })
    }).catch(err => {
        errorSyntaxHandle(err, res)
    })
});
//TODO ping docker container
