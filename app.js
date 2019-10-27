const logger = require('./common/nodejs/logger').new('express API');
const {fsExtra, homeResolve} = require('./common/nodejs');
const path = require('path');
const helper = require('./app/helper.js');
const port = 4000;
const globalConfig = require('./config/orgs.json');
const channelsConfig = globalConfig.channels;
const CONFIGTXDir = homeResolve(globalConfig.docker.volumes.CONFIGTX);


const {create: createChannel} = require('./app/channelHelper');
const {join: joinChannel} = require('./common/nodejs/channel');

const Query = require('./common/nodejs/query');
const {app} = require('khala-nodeutils/baseApp').run(port);


app.use('/config', require('./express/configExpose'));

app.get('/', (req, res) => {
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

	const {channelName} = req.params;
	const {orgName} = req.body;

	try {
		invalid.channelName({channelName});
		invalid.orgName({orgName});

		const channelFileName = channelsConfig[channelName].file;
		const channelConfigFile = path.resolve(CONFIGTXDir, channelFileName);
		logger.debug('create Channel', {orgName, channelName, channelConfigFile});
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
	const {channelName} = req.params;
	try {
		invalid.channelName({channelName});
		const {orgName, peerIndex} = req.body;
		logger.debug('joinChannel', {channelName, orgName, peerIndex});

		invalid.peer({orgName, peerIndex});

		const peer = helper.newPeer(peerIndex, orgName);
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
	const {blockNumber} = req.params;
	const {peerIndex, orgName, channelName} = req.body;

	try {
		invalid.peer({orgName, peerIndex});
		logger.debug('GET BLOCK BY NUMBER ', {blockNumber, peerIndex, orgName, channelName});

		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const peer = helper.newPeer(peerIndex, orgName);

		const message = await Query.blockFromHeight(peer, channel, blockNumber);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});
// Query Get Block by Hash
app.post('/query/block/hash', async (req, res) => {
	const {hashHex, peerIndex, orgName, channelName} = req.body;
	logger.debug('GET BLOCK BY HASH', {hashHex, peerIndex, orgName, channelName});
	try {
		invalid.peer({orgName, peerIndex});
		const peer = helper.newPeer(peerIndex, orgName);
		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const message = await Query.blockFromHash(peer, channel, hashHex);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});
// Query Get Transaction by Transaction ID
app.post('/query/tx', async (req, res) => {
	const {txId, orgName, peerIndex, channelName} = req.body;
	logger.debug('GET TRANSACTION BY TRANSACTION_ID', {txId, orgName, peerIndex, channelName});
	try {
		invalid.peer({orgName, peerIndex});
		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const peer = helper.newPeer(peerIndex, orgName);
		const message = await Query.tx(peer, channel, txId);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}
});

// Query for Channel Information
// NOTE: blockchain is summary for all channel and chaincode
app.post('/query/chain', async (req, res) => {
	const {orgName, peerIndex, channelName, pretty} = req.body;
	logger.debug('GET blockchain INFORMATION', {orgName, peerIndex, channelName});

	try {
		invalid.peer({orgName, peerIndex});
		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const peer = helper.newPeer(peerIndex, orgName);
		const message = await Query.chain(peer, channel);
		res.send(pretty ? {pretty: message.pretty} : message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});
// Query to fetch all Installed/instantiated chaincodes
app.post('/query/chaincodes/installed', async (req, res) => {
	const {orgName, peerIndex} = req.body;
	logger.debug('query installed CHAINCODE', {orgName, peerIndex});
	try {
		invalid.peer({orgName, peerIndex});
		const peer = helper.newPeer(peerIndex, orgName);
		const client = await helper.getOrgAdmin(orgName);
		const message = await Query.chaincodesInstalled(peer, client);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}
});
app.post('/query/chaincodes/instantiated', async (req, res) => {
	const {orgName, peerIndex, channelName} = req.body;
	logger.debug('query instantiated CHAINCODE', {orgName, peerIndex, channelName});
	try {
		invalid.peer({orgName, peerIndex});
		const peer = helper.newPeer(peerIndex, orgName);
		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client);
		const message = await Query.chaincodesInstantiated(peer, channel);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}
});
// Query to fetch channels
app.post('/query/channelJoined', async (req, res) => {
	const {orgName, peerIndex} = req.body;
	logger.debug('query joined CHANNELS', {orgName, peerIndex});
	try {
		invalid.peer({orgName, peerIndex});
		const peer = helper.newPeer(peerIndex, orgName);
		const client = await helper.getOrgAdmin(orgName);
		const message = await Query.channelJoined(peer, client);
		res.send(message);
	} catch (err) {
		errorSyntaxHandle(err, res);
	}

});
