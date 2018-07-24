const logger = require('./common/nodejs/logger').new('express API');
const {homeResolve, fsExtra} = require('./common/nodejs/path');
const path = require('path');
const port = 4000;
const globalConfig = require('./config/orgs.json');
const channelsConfig = globalConfig.channels;
const CONFIGTXDir = homeResolve(globalConfig.docker.volumes.CONFIGTX.dir);

const helper = require('./app/helper.js');
const {create: createChannel} = require('./app/channelHelper');
const {join: joinChannel} = require('./common/nodejs/channel');

const Query = require('./common/nodejs/query');
const {app} = require('./common/nodejs/express/baseApp').run(port);


app.use('/config', require('./express/configExpose'));

app.get('/', (req, res, next) => {
	res.send('pong from davids server');
});

const invalid = require('./express/formValid').invalid();
const errorCodeMap = require('./express/errorCodeMap.js');
const errorSyntaxHandle = (err, res) => {
	const status = errorCodeMap.get(err);
	res.status(status);
	res.send(err.toString());
};

// Create Channel
app.post('/channel/create/:channelName', async (req, res) => {

	logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
	const {channelName} = req.params;
	const {orgName} = req.body;

	try {
		invalid.channelName({channelName});
		invalid.orgName({orgName});

		const channelFileName = channelsConfig[channelName].file;
		const channelConfigFile = path.resolve(CONFIGTXDir, channelFileName);
		logger.debug({orgName, channelName, channelConfigFile});
		if (!fsExtra.pathExistsSync(channelConfigFile)) {
			throw Error(`channelConfigFile ${channelConfigFile} not exist`);
		}


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
	try {
		invalid.channelName({channelName});
		const {orgName, peerIndex} = req.body;
		logger.debug({channelName, orgName, peerIndex});

		invalid.peer({orgName, peerIndex});

		const peer = helper.newPeers([peerIndex], orgName)[0];
		const client = await helper.getOrgAdmin(orgName, 'peer');
		const channel = helper.prepareChannel(channelName, client);
		await joinChannel(channel, peer);
		res.send(`peer${peerIndex}.${orgName} has joined channel ${channelName} successfully`);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});

//  Query Get Block by BlockNumber
app.post('/query/block/height/:blockNumber', async (req, res) => {
	logger.debug('==================== GET BLOCK BY NUMBER ==================');
	const {blockNumber} = req.params;
	const {peerIndex, orgName, channelName} = req.body;

	try {
		invalid.peer({orgName, peerIndex});
		logger.debug({blockNumber, peerIndex, orgName, channelName});

		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const peer = helper.newPeers([peerIndex], orgName)[0];

		const message = await Query.block.height(peer, channel, blockNumber);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});
// Query Get Block by Hash
app.post('/query/block/hash', async (req, res) => {
	logger.debug('================ GET BLOCK BY HASH ======================');
	const {hashHex, peerIndex, orgName, channelName} = req.body;
	logger.debug({hashHex, peerIndex, orgName, channelName});
	try {
		invalid.peer({orgName, peerIndex});
		const peer = helper.newPeers([peerIndex], orgName)[0];
		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const message = await Query.block.hash(peer, channel, Buffer.from(hashHex, 'hex'));
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});
// Query Get Transaction by Transaction ID
app.post('/query/tx', async (req, res) => {
	logger.debug('================ GET TRANSACTION BY TRANSACTION_ID ======================');
	const {txId, orgName, peerIndex, channelName} = req.body;
	logger.debug({txId, orgName, peerIndex, channelName});
	try {
		invalid.peer({orgName, peerIndex});
		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const peer = helper.newPeers([peerIndex], orgName)[0];
		const message = await Query.tx(peer, channel, txId);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}
});

//Query for Channel Information
//NOTE: blockchain is summary for all channel and chaincode
app.post('/query/chain', async (req, res) => {
	logger.debug('================ GET blockchain INFORMATION ======================');
	const {orgName, peerIndex, channelName, pretty} = req.body;
	logger.debug({orgName, peerIndex, channelName});

	try {
		invalid.peer({orgName, peerIndex});
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
app.post('/query/chaincodes/installed', async (req, res) => {
	logger.debug('==================== query installed CHAINCODE ==================');
	const {orgName, peerIndex} = req.body;
	logger.debug({orgName, peerIndex});
	try {
		invalid.peer({orgName, peerIndex});
		const peer = helper.newPeers([peerIndex], orgName)[0];
		const client = await helper.getOrgAdmin(orgName);
		const message = await Query.chaincodes.installed(peer, client);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}
});
app.post('/query/chaincodes/instantiated', async (req, res) => {
	logger.debug('==================== query instantiated CHAINCODE ==================');
	const {orgName, peerIndex, channelName} = req.body;
	logger.debug({orgName, peerIndex, channelName});
	try {
		invalid.peer({orgName, peerIndex});
		const peer = helper.newPeers([peerIndex], orgName)[0];
		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const message = await Query.chaincodes.instantiated(peer, channel);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}
});
// Query to fetch channels
app.post('/query/channelJoined', async (req, res) => {
	logger.debug('================ query joined CHANNELS ======================');
	const {orgName, peerIndex} = req.body;
	logger.debug({orgName, peerIndex});
	try {
		invalid.peer({orgName, peerIndex});
		const peer = helper.newPeers([peerIndex], orgName)[0];
		const client = await helper.getOrgAdmin(orgName);
		const message = await Query.channel.joined(peer, client);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});
