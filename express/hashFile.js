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
	for (const errorMessage in errorCodeMap) {
		if (err.toString().includes(errorMessage)) {
			status = errorCodeMap[errorMessage];
			break;
		}
	}
	res.status(status).json({error: err.toString()});

};
router.use((req, res, next) => {
	const user = req.body;
	if (!user) return errorHandle(`user is ${user}`, res);
	const {username, password, token} = user;
	const oauthClient = require('./oauth2Client').passwordGrant;

	if (!token) {
		if (!username || !password) {
			return errorHandle(`missing user identity  ${user}`, res);
		}
		oauthClient.getToken({username, password})
			.then(accessToken => {
				res.locals.accessToken = accessToken.accessToken.accessToken;
				next();
				return Promise.resolve(accessToken.accessToken.accessToken);
			});
	} else {
		//TODO request TK platform to authenticate token
		oauthClient.verify(token).then(result => {
			if (result) {
				res.locals.accessToken = token;
				next();
			}
		});


	}
});
const Request = require('request');
router.post('/write', cache.array('files'), (req, res) => {
	const {id, plain, toHash} = req.body;
	const {accessToken} = req.locals;
	let {org} = req.body;
	logger.debug('write', {id, plain, toHash, org});

	if (!id) return errorHandle(`id is ${id}`, res);
	if (!org) return errorHandle(`org is ${org}`, res);
	const files = req.files;

	const promise = Promise.resolve();

	const fileStreams = files.map(({path}) => {
		return fs.createReadStream(path);
	});
	const formData = {
		// Pass a simple key-value pair
		my_field: 'my_value',
		// Pass data via Buffers
		my_buffer: new Buffer([1, 2, 3]),
		// Pass multiple values /w an Array
		files: fileStreams,
	};
	Request.post({url: 'http://service.com/upload', formData: formData}, (err, resp, body) => {
		if (err) {
			return logger.error('upload failed:', err);
		}
		logger.debug('Upload successful!  Server responded with:', body);
	});


	const textHash = hashAlgo(toHash);

	const value = `${plain}|${textHash}|${fileHashs.join('|')}`;
	const {fcn, args, orgName, peerIndex} = {
		fcn: 'write',
		args: [id, value],
		orgName: org,
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

	promise.then(() => helper.getOrgAdmin(orgName)).then((client) => {
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
	let {org} = req.body;
	logger.debug('delete', {id, org});

	if (!id) return errorHandle(`id is ${id}`, res);
	if (!org) return errorHandle(`org is ${org}`, res);
	const {fcn, args, orgName, peerIndex} = {
		fcn: 'delete',
		args: [id],
		orgName: org,
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
	const {org} = req.body;
	logger.debug('read', {id, org});

	if (!id) return errorHandle(`id is ${id}`, res);
	if (!org) return errorHandle(`org is ${org}`, res);

	const {fcn, args, orgName, peerIndex} = {
		fcn: 'read',
		args: [id],
		orgName: org,
		peerIndex: 0,
	};
	if (org === 'TK') {
		let {delegatedOrg} = req.body;
		if (!delegatedOrg) {
			delegatedOrg = 'TK';
		}
		args.push(delegatedOrg);
	}
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