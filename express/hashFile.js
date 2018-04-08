const express = require('express');
const router = express.Router();
const logger = require('../app/util/logger').new('hash record');


const Multer = require('multer');
const cache = Multer({dest: 'cache/'});

const fs = require('fs');
const hashAlgo = require('fabric-client/lib/hash').sha2_256;

const helper = require('../app/helper.js');
const invalid = require('./formValid').invalid();
const {reducer} = require('../app/util/chaincode');

const channelName = 'allChannel';
const chaincodeId = 'hashChaincode';
const errorHandle = (err, res) => {
	const errorCodeMap = require('./errorCodeMap.json');

	let status = 500;
	for (let errorMessage in errorCodeMap) {
		if (err.toString().includes(errorMessage)) {
			status = errorCodeMap[errorMessage];
			break;
		}
	}
	res.status(status).json({error: err.toString()});

};
router.post('/write', cache.array('files'), (req, res) => {
	const {id, plain, toHash} = req.body;
	let {party} = req.body;
	if (!party) party = 'TK';
	logger.debug('write', {id, plain, toHash, party});

	if (!id) return errorHandle(`id is ${id}`, res);
	if (!party) return errorHandle(`party is ${party}`, res);
	const files = req.files;

	const fileHashs = files.map(({size, path}) => {
		const startTime = new Date().getTime();
		const data = fs.readFileSync(path);
		const hashData = hashAlgo(data);
		const endTime = new Date().getTime();
		logger.debug('hashing file', path, {size}, `consumed, ${endTime - startTime}ms`);
		fs.unlinkSync(path);
		return hashData;
	});
	const textHash = hashAlgo(toHash);

	const value = `${plain}|${textHash}|${fileHashs.join('|')}`;
	const {fcn, args, orgName, peerIndex} = {
		fcn: 'write',
		args: [id, value],
		orgName: party,
		peerIndex: 0,
	};
	const {invoke} = require('../app/invoke-chaincode.js');

	logger.debug({chaincodeId, fcn, orgName, peerIndex, channelName});
	const invalidPeer = invalid.peer({peerIndex, orgName});
	if (invalidPeer) return errorHandle(invalidPeer, res);

	const invalidChannelName = invalid.channelName({channelName});
	if (invalidChannelName) return errorHandle(invalidChannelName, res);

	const invalidArgs = invalid.args({args});
	if (invalidArgs) return errorHandle(invalidArgs, res);

	helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client);
		const peers = helper.newPeers([peerIndex], orgName);
		return invoke(channel, peers, {
			chaincodeId, fcn,
			args
		}).then((message) => {
			const data = reducer(message);
			res.json({data: data.responses});

		}).catch(err => {
			logger.error(err);
			const {proposalResponses} = err;
			if (proposalResponses) {
				errorHandle(proposalResponses, res);
			} else {
				errorHandle(err, res);
			}
		});
	});


});
router.post('/delete', (req, res) => {
	const {id} = req.body;
	let {party} = req.body;
	if (!party) party = 'TK';
	logger.debug('delete', {id, party});

	if (!id) return errorHandle(`id is ${id}`, res);
	if (!party) return errorHandle(`party is ${party}`, res);
	const {fcn, args, orgName, peerIndex} = {
		fcn: 'delete',
		args: [id],
		orgName: party,
		peerIndex: 0,
	};
	const {invoke} = require('../app/invoke-chaincode.js');

	logger.debug({chaincodeId, fcn, orgName, peerIndex, channelName});
	const invalidPeer = invalid.peer({peerIndex, orgName});
	if (invalidPeer) return errorHandle(invalidPeer, res);

	const invalidChannelName = invalid.channelName({channelName});
	if (invalidChannelName) return errorHandle(invalidChannelName, res);

	const invalidArgs = invalid.args({args});
	if (invalidArgs) return errorHandle(invalidArgs, res);

	helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client);
		const peers = helper.newPeers([peerIndex], orgName);
		return invoke(channel, peers, {
			chaincodeId, fcn,
			args
		}).then((message) => {
			const data = reducer(message);
			res.json({data: data.responses});

		}).catch(err => {
			logger.error(err);
			const {proposalResponses} = err;
			if (proposalResponses) {
				errorHandle(proposalResponses, res);
			} else {
				errorHandle(err, res);
			}
		});
	});
});
router.post('/read', (req, res) => {
	const {id} = req.body;
	let {party} = req.body;
	if (!party) party = 'TK';
	logger.debug('read', {id, party});

	if (!id) return errorHandle(`id is ${id}`, res);
	if (!party) return errorHandle(`party is ${party}`, res);

	const {fcn, args, orgName, peerIndex} = {
		fcn: 'read',
		args: [id],
		orgName: party,
		peerIndex: 0,
	};
	const {invoke} = require('../app/invoke-chaincode.js');

	logger.debug({chaincodeId, fcn, orgName, peerIndex, channelName});
	const invalidPeer = invalid.peer({peerIndex, orgName});
	if (invalidPeer) return errorHandle(invalidPeer, res);

	const invalidChannelName = invalid.channelName({channelName});
	if (invalidChannelName) return errorHandle(invalidChannelName, res);

	const invalidArgs = invalid.args({args});
	if (invalidArgs) return errorHandle(invalidArgs, res);

	helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client);
		const peers = helper.newPeers([peerIndex], orgName);
		return invoke(channel, peers, {
			chaincodeId, fcn,
			args
		}).then((message) => {
			const data = reducer(message);
			res.json({data: data.responses});

		}).catch(err => {
			logger.error(err);
			const {proposalResponses} = err;
			if (proposalResponses) {
				errorHandle(proposalResponses, res);
			} else {
				errorHandle(err, res);
			}
		});
	});
});


module.exports = router;