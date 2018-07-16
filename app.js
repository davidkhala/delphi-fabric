const logger = require('./common/nodejs/logger').new('express API');
const golangUtil = require('./common/nodejs/golang');
const {homeResolve, fsExtra} = require('./common/nodejs/path');
const path = require('path');
const {host, port} = require('./app/config.json');
const globalConfig = require('./config/orgs.json');
const channelsConfig = globalConfig.channels;
const chaincodesConfig = require('./config/chaincode.json');
const CONFIGTXDir = homeResolve(globalConfig.docker.volumes.CONFIGTX.dir);

const helper = require('./app/helper.js');
const {create: createChannel} = require('./app/channelHelper');
const {join: joinChannel} = require('./common/nodejs/channel');

const Query = require('./common/nodejs/query');
const {app, server} = require('./common/nodejs/express/baseApp').run(port, host);
const {install} = require('./common/nodejs/chaincode');


app.use('/config', require('./express/configExpose'));

app.get('/', (req, res, next) => {
	res.send('pong from davids server');
});

const {wsServerBuilder} = require('./express/webSocketCommon');
const onMessage = async (data, ws) => {
	ws.send(`echo ${data}`);
};
const wss = wsServerBuilder(server, onMessage);


app.use('/chaincode', require('./express/http-chaincode'));


const invalid = require('./express/formValid').invalid();
const errorCodeMap = require('./express/errorCodeMap.json');
const errorSyntaxHandle = (err, res) => {
	let status = 500;
	for (const errorMessage in errorCodeMap) {
		if (err.toString().includes(errorMessage)) {
			status = errorCodeMap[errorMessage];
			break;
		}
	}
	res.status(status);
	res.send(err.toString());
};

// Create Channel
app.post('/channel/create/:channelName', async (req, res) => {

	logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
	const {channelName} = req.params;
	const {orgName} = req.body;

	const invalidChannelName = invalid.channelName({channelName});
	if (invalidChannelName) {
		errorSyntaxHandle(invalidChannelName, res);
		return;
	}
	const invalidOrgName = invalid.orgName({orgName});
	if (invalidOrgName) {
		errorSyntaxHandle(invalidOrgName, res);
		return;
	}
	const channelFileName = channelsConfig[channelName].file;
	const channelConfigFile = path.resolve(CONFIGTXDir, channelFileName);
	logger.debug({orgName, channelName, channelConfigFile});
	if (!fsExtra.pathExistsSync(channelConfigFile)) {
		errorSyntaxHandle(`channelConfigFile ${channelConfigFile} not exist`, res);
		return;
	}

	try {
		const client = await helper.getOrgAdmin(orgName);
		await createChannel(client, channelName, channelConfigFile, [orgName]);
		res.send(`channel ${channelName} created successfully by ${orgName} with configuration in ${channelConfigFile}`);
	} catch (err) {
		logger.error(err);
		errorSyntaxHandle(err, res);
	}
});
// Join Channel
app.post('/channel/join/:channelName', async (req, res) => {
	logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
	const {channelName} = req.params;

	const invalidChannelName = invalid.channelName({channelName});
	if (invalidChannelName) {
		errorSyntaxHandle(invalidChannelName, res);
		return;
	}

	const {orgName, peerIndex} = req.body;
	logger.debug({channelName, orgName, peerIndex});

	const invalidPeer = invalid.peer({orgName, peerIndex});
	if (invalidPeer) {
		errorSyntaxHandle(invalidPeer, res);
		return;
	}

	try {
		const peer = helper.newPeers([peerIndex], orgName)[0];
		const client = await helper.getOrgAdmin(orgName, 'peer');
		const channel = helper.prepareChannel(channelName, client);
		const eventHub = await peer.eventHubPromise;
		await joinChannel(channel, peer, eventHub);
		res.send(`peer${peerIndex}.${orgName} has joined channel ${channelName} successfully`);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});
// Install chaincode on target peers
app.post('/chaincode/install/:chaincodeId', async (req, res) => {
	logger.debug('==================== INSTALL CHAINCODE ==================');
	const {chaincodeId} = req.params;
	const {peerIndex, chaincodeVersion, orgName} = req.body;

	const invalidChaincodeId = invalid.chaincodeId({chaincodeId});
	if (invalidChaincodeId) {
		res.send(invalidChaincodeId);
		return;
	}
	const invalidPeer = invalid.peer({orgName, peerIndex});
	if (invalidPeer) {
		res.send(invalidPeer);
		return;
	}
	const chaincodeConfig = chaincodesConfig.chaincodes[chaincodeId];
	const chaincodePath = chaincodeConfig.path;

	const peers = helper.newPeers([peerIndex], orgName);
	//TODO to test ChaincodeVersion

	try {
		await golangUtil.setGOPATH();
		const client = await helper.getOrgAdmin(orgName);
		await install(peers, {chaincodeId, chaincodePath, chaincodeVersion}, client);
		res.send(`install chaincode ${chaincodeId} of version ${chaincodeVersion} to peer${peerIndex}.${orgName} successfully`);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});
//  Query Get Block by BlockNumber
app.post('/query/block/height/:blockNumber', (req, res) => {
	logger.debug('==================== GET BLOCK BY NUMBER ==================');
	const {blockNumber} = req.params;
	const {peerIndex, orgName, channelName} = req.body;

	const invalidPeer = invalid.peer({orgName, peerIndex});
	if (invalidPeer) {
		res.send(invalidPeer);
		return;
	}
	logger.debug({blockNumber, peerIndex, orgName, channelName});

	helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client);
		const peer = helper.newPeers([peerIndex], orgName)[0];
		return Query.block.height(peer, channel, blockNumber).then((message) => {
			res.send(message);
		}).catch(err => {
			errorSyntaxHandle(err, res);
		});
	});

});
// Query Get Block by Hash
app.post('/query/block/hash', (req, res) => {
	logger.debug('================ GET BLOCK BY HASH ======================');
	const {hashHex, peerIndex, orgName, channelName} = req.body;
	logger.debug({hashHex, peerIndex, orgName, channelName});
	const invalidPeer = invalid.peer({orgName, peerIndex});
	if (invalidPeer) {
		res.send(invalidPeer);
		return;
	}
	const peer = helper.newPeers([peerIndex], orgName)[0];
	helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client);
		return Query.block.hash(peer, channel, Buffer.from(hashHex, 'hex')).then((message) => {
			res.send(message);
		}).catch(err => {
			errorSyntaxHandle(err, res);
		});
	});

});
// Query Get Transaction by Transaction ID
app.post('/query/tx', (req, res) => {
	logger.debug('================ GET TRANSACTION BY TRANSACTION_ID ======================');
	const {txId, orgName, peerIndex, channelName} = req.body;
	logger.debug({txId, orgName, peerIndex, channelName});
	const invalidPeer = invalid.peer({orgName, peerIndex});
	if (invalidPeer) {
		res.send(invalidPeer);
		return;
	}
	helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client);
		const peer = helper.newPeers([peerIndex], orgName)[0];
		return Query.tx(peer, channel, txId).then((message) => {
			res.send(message);
		}).catch(err => {
			errorSyntaxHandle(err, res);
		});
	});

});

//Query for Channel Information
//NOTE: blockchain is summary for all channel and chaincode
app.post('/query/chain', async (req, res) => {
	logger.debug('================ GET blockchain INFORMATION ======================');
	const {orgName, peerIndex, channelName, pretty} = req.body;
	logger.debug({orgName, peerIndex, channelName});

	const invalidPeer = invalid.peer({orgName, peerIndex});
	if (invalidPeer) {
		res.send(invalidPeer);
		return;
	}
	try {
		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const peer = helper.newPeers([peerIndex], orgName)[0];
		const message = await Query.chain(peer, channel);
		res.send(pretty ? {pretty: message.pretty} : message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}


});
// Query to fetch all Installed/instantiated chaincodes
app.post('/query/chaincodes/installed', (req, res) => {
	logger.debug('==================== query installed CHAINCODE ==================');
	const {orgName, peerIndex} = req.body;
	logger.debug({orgName, peerIndex});
	const invalidPeer = invalid.peer({orgName, peerIndex});
	if (invalidPeer) {
		res.send(invalidPeer);
		return;
	}

	const peer = helper.newPeers([peerIndex], orgName)[0];
	helper.getOrgAdmin(orgName).then((client) => {
		return Query.chaincodes.installed(peer, client).then((message) => {
			res.send(message);
		});
	}).catch(err => {
		errorSyntaxHandle(err, res);
	});
});
app.post('/query/chaincodes/instantiated', (req, res) => {
	logger.debug('==================== query instantiated CHAINCODE ==================');
	const {orgName, peerIndex, channelName} = req.body;
	logger.debug({orgName, peerIndex, channelName});
	const invalidPeer = invalid.peer({orgName, peerIndex});
	if (invalidPeer) {
		res.send(invalidPeer);
		return;
	}
	const peer = helper.newPeers([peerIndex], orgName)[0];
	helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client);
		return Query.chaincodes.instantiated(peer, channel).then((message) => {
			res.send(message);
		});
	}).catch(err => {
		errorSyntaxHandle(err, res);
	});
});
// Query to fetch channels
app.post('/query/channelJoined', (req, res) => {
	logger.debug('================ query joined CHANNELS ======================');
	const {orgName, peerIndex} = req.body;
	logger.debug({orgName, peerIndex});
	const invalidPeer = invalid.peer({orgName, peerIndex});
	if (invalidPeer) {
		res.send(invalidPeer);
		return;
	}
	const peer = helper.newPeers([peerIndex], orgName)[0];
	helper.getOrgAdmin(orgName).then((client) => {
		return Query.channel.joined(peer, client).then((
			message) => {
			res.send(message);
		});
	}).catch(err => {
		errorSyntaxHandle(err, res);
	});
});
//TODO ping docker container
