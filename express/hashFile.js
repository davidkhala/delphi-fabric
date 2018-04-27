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
const TKOrgName = 'TK.Teeking.com'

const baseUrl = 'http://192.168.3.139:8080/teeking-api/api';
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


const userMiddleware = (req, res, next) => {
	const {username, password, token} = req.body;
	const oauthClient = require('./oauth2Client').passwordGrant;
	let promise = Promise.resolve();

	const oauthEnable = false;
	if (oauthEnable) {
		if (!token) {
			if (!username || !password) {
				return errorHandle('missing user identity ', res);
			}
			promise = promise.then(() => oauthClient.getToken({username, password}))
				.then(accessToken => {
					res.locals.accessToken = accessToken.accessToken.accessToken;
					next();
					return Promise.resolve(accessToken);
				});
		} else {
			//TODO request TK platform to authenticate token
			promise = promise.then(() => oauthClient.verify(token)).then(result => {
				if (result) {
					res.locals.accessToken = token;
					next();
					return Promise.resolve(result);
				}
			});
		}
	} else {
		promise = promise.then(() => new Promise((resolve, reject) => {
			Request.post({
				url: `${baseUrl}/tokens`, formData: {
					name: username, password
				}
			}, (err, resp, body) => {
				if (err) return reject(err);
				const {token, userid} = JSON.parse(body);
				res.locals.accessToken = token;
				next();
				return resolve();
			});
		}));

	}

	promise.catch(err => {
		res.status(400).send(err);
	});
};
const Request = require('request');
const peerIndex = 0;
router.post('/write', cache.array('files'), (req, res) => {
	const {id, plain, toHash} = req.body;
	let {accessToken} = res.locals;
	if(!accessToken)accessToken = '';//FIXME
	const {org: orgName} = req.body;
	logger.debug('write', {id, plain, toHash, orgName});

	if (!id) return errorHandle(`id is ${id}`, res);
	if (!orgName) return errorHandle(`org is ${orgName}`, res);

	const invalidPeer = invalid.peer({peerIndex, orgName});
	if (invalidPeer) return errorHandle(invalidPeer, res);
	const files = req.files;

	let promise = Promise.resolve();

	const fileStreams = files.map(({path}) => {
		return fs.createReadStream(path);
	});


	const uploadFilesRequest = () => new Promise((resolve, reject) => {
		const formData = {
			accessToken,
			files: fileStreams,
		};
		Request.post({url: `${baseUrl}/files`, formData,timeout:1000}, (err, resp, body) => {
			logger.debug({err,body});
			if (err) {
				return reject(err);
			}
			logger.debug('Upload successful!  Server responded with:', body);
			resolve(JSON.parse(body))
		});
	});

	const assetsRequest = () => new Promise((resolve, reject) => {
		const form = {
			accessToken, type:plain, data:toHash
		};

		Request.post({url: `${baseUrl}/blockchain`, form}, (err, resp, body) => {
			if (err) {
				reject(err);
			}
			logger.debug('sql server response with:', body);
			resolve(JSON.parse(body));

		});
	});
	promise = promise
		// .then(uploadFilesRequest)
		.then(assetsRequest)
		.then(body => {
			const {success, message, data:{ischain, req_data, hash}} = body;
			const fcn = 'write';
			const args = [id, hash];

			logger.debug({chaincodeId, fcn, orgName, peerIndex, channelName});
			const invalidArgs = invalid.args({args});
			if (invalidArgs) reject(invalidArgs);

			return Promise.resolve({fcn:ischain?fcn:undefined, args});
		})
		.then(({fcn, args}) => {
			if (!fcn) {
				res.json({data: 'not to update blockchain'});
				return;
			}
			const {invoke} = require('../app/invoke-chaincode.js');
			return helper.getOrgAdmin(orgName).then((client) => {
				const channel = helper.prepareChannel(channelName, client);
				const peers = helper.newPeers([peerIndex], orgName);
				return invoke(channel, peers, {
					chaincodeId, fcn,
					args
				}).then((message) => {
					const data = reducer(message);
					res.json({data: data.responses});

				});
			});
		});

	promise.catch(err => {
		logger.error(err);
		const {proposalResponses} = err;
		if (proposalResponses) {
			errorHandle(proposalResponses, res);
		} else {
			errorHandle(err, res);
		}
	});

});
router.post('/delete', (req, res) => {
	const {id} = req.body;
	const {org: orgName} = req.body;
	logger.debug('delete', {id, orgName});

	if (!id) return errorHandle(`id is ${id}`, res);
	if (!orgName) return errorHandle(`org is ${orgName}`, res);
	const fcn = 'delete';
	const args = [id];
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
	const {org: orgName} = req.body;
	logger.debug('read', {id, orgName});

	if (!id) return errorHandle(`id is ${id}`, res);
	if (!orgName) return errorHandle(`org is ${orgName}`, res);

	const fcn = 'read';

	const args = [id];
	if (orgName === TKOrgName) {
		let {delegatedOrg} = req.body;
		if (!delegatedOrg) {
			delegatedOrg = TKOrgName;
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

router.get('/worldState', (req, res) => {


	const fcn = 'worldStates';

	const args = [];
	const {invoke} = require('../app/invoke-chaincode.js');

	helper.getOrgAdmin(TKOrgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client);
		const peers = helper.newPeers([peerIndex], TKOrgName);
		return invoke(channel, peers, {
			chaincodeId, fcn,
			args
		}).then((message) => {
			const data = reducer(message);
			res.json({data: JSON.parse(data.responses)});

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