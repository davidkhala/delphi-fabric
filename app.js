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
'use strict'
const logger = require('./app/util/logger').new('express API')
const express = require('express')
const bodyParser = require('body-parser')
const http = require('http')
const path = require('path')
const fs = require('fs')
const app = express()
const cors = require('cors')
const config = require('./app/config.json')
const companyConfig = require('./config/orgs.json').delphi
const channelsConfig = companyConfig.channels
const orgsConfig = companyConfig.orgs
const chaincodesConfig = require('./config/chaincode.json')
const CONFIGTXDir = companyConfig.docker.volumes.CONFIGTX.dir

const helper = require('./app/helper.js')
const createChannel = require('./app/create-channel').create
const joinChannel = require('./app/join-channel').joinChannel

const Query = require('./app/query')
const install = require('./app/install-chaincode.js').install
const instantiate = require('./app/instantiate-chaincode.js').instantiate
const { invokeChaincode: invoke, reducer } = require('./app/invoke-chaincode.js')
const host = config.host
const port = config.port
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATONS ////////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors())
app.use(cors())
//support parsing of application/json type post data
app.use(bodyParser.json())
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
	extended: false
}))
app.use('/config', require('./express/configExpose'))
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
const server = http.createServer(app).listen(port, function() {})
logger.info('****************** SERVER STARTED ************************')
logger.info('**************  http://' + host + ':' + port +
		'  ******************')
server.timeout = 240000

const getErrorMessage = (message) => {
	return {
		success: false,
		message
	}
}
const invalid = {
	orgName: (res, { orgName }) => {
		const orgConfig = orgsConfig[orgName]
		if (!orgConfig) {
			res.json(getErrorMessage(`config of org '${orgName}' not found`))
			return true
		}
		return false
	},
	channelName: (res, { channelName }) => {
		const channelConfig = channelsConfig[channelName]
		if (!channelConfig) {
			res.json(getErrorMessage(`config of channel '${channelName}' not found`))
			return true
		}
		return false
	},
	peer: (res, { orgName, peerIndex }) => {
		if (invalid.orgName(res, { orgName })) return true
		const orgConfig = orgsConfig[orgName]
		const peerConfig = orgConfig.peers[peerIndex]
		if (!peerConfig) {
			res.json(getErrorMessage(`config of peer${peerIndex}.${orgName} not found`))
			return true
		}
		return false
	},
	chaincodeVersion: (res, { chaincodeVersion }) => {
		//TODO
	},
	chaincodeId: (res, { chaincodeId }) => {
		const chaincodeConfig = chaincodesConfig.chaincodes[chaincodeId]
		if (!chaincodeConfig) {
			res.json(getErrorMessage(`config of chaincode ${chaincodeId} not found`))
			return true
		}
		return false
	}
}
const errorSyntaxHandle = (err, res) => {
	if (err.toString().includes('BAD_REQUEST')) {
		res.status(400)
	}
	if (err.toString().includes('FORBIDDEN')) {
		res.status(403)
	}
	if (err.toString().includes('Failed to deserialize creator identity')) {
		res.status(401)
	}

	if (err.toString().includes('NOT_FOUND') || err.toString().includes('could not find')
			|| err.toString().includes('no such file or directory')
			|| err.toString().includes('not found')) {
		res.status(404)
	}
	if (err.toString().includes('Connect Failed') || err.toString().includes('Service Unavailable')) {
		res.status(503)
	}

	res.send(err.toString())
}

// Create Channel
app.post('/channel/create/:channelName', (req, res) => {

	logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>')
	const { channelName } = req.params
	const { orgName } = req.body

	if (invalid.channelName(res, { channelName })) return
	if (invalid.orgName(res, { orgName })) return
	const channelFileName = channelsConfig[channelName].file
	const channelConfigFile = path.resolve(CONFIGTXDir, channelFileName)
	logger.debug({ orgName, channelName, channelConfigFile })

	if (!fs.existsSync(channelConfigFile)) {
		res.json(getErrorMessage(`channelConfigFile ${channelConfigFile} not exist`))
		return
	}

	createChannel(channelName, channelConfigFile, [orgName]).then((message) => {
		res.send(`channel ${channelName} created successfully by ${orgName} with configuration in ${channelConfigFile}`)
	}).catch(err => {
		errorSyntaxHandle(err, res)
	})
})
// Join Channel
app.post('/channel/join/:channelName', (req, res) => {
	logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>')
	const { channelName } = req.params

	if (invalid.channelName(res, { channelName })) return
	const { orgName, peerIndex } = req.body
	logger.debug({ channelName, orgName, peerIndex })

	if (invalid.peer(res, { orgName, peerIndex })) return

	const peers = helper.newPeers([peerIndex], orgName)

	const client = helper.getClient()
	helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client)
		return joinChannel(channel, peers).then((message) => {
			res.send(`peer${peerIndex}.${orgName} has joined channel ${channelName} successfully`)
		})
	}).catch(err => {
		errorSyntaxHandle(err, res)
	})

})
// Install chaincode on target peers
app.post('/chaincode/install/:chaincodeId', (req, res) => {
	logger.debug('==================== INSTALL CHAINCODE ==================')
	const { chaincodeId } = req.params
	const { peerIndex, chaincodeVersion, orgName } = req.body

	if (invalid.chaincodeId(res, { chaincodeId })) return
	if (invalid.peer(res, { orgName, peerIndex })) return
	const chaincodeConfig = chaincodesConfig.chaincodes[chaincodeId]
	const chaincodePath = chaincodeConfig.path

	const peers = helper.newPeers([peerIndex], orgName)
	//TODO to test ChaincodeVersion

	helper.setGOPATH()
	const client = helper.getClient()
	helper.getOrgAdmin(orgName, client).then(() => {
		return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client).
				then((message) => {
					res.send(
							`install chaincode ${chaincodeId} of version ${chaincodeVersion} to peer${peerIndex}.${orgName} successfully`)
				})
	})

})
// Instantiate chaincode on target peers
app.post('/chaincode/instantiate/:chaincodeId', (req, res) => {
	logger.debug('==================== INSTANTIATE CHAINCODE ==================')
	const { chaincodeId } = req.params

	const { chaincodeVersion, channelName, fcn, args, peerIndex, orgName } = req.body
	logger.debug({ channelName, chaincodeId, chaincodeVersion, fcn, args })
	if (invalid.peer(res, { peerIndex, orgName })) return
	if (invalid.chaincodeId(res, { chaincodeId })) return
	if (invalid.channelName(res, { channelName })) return
	const client = helper.getClient()
	helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client)
		const peers = helper.newPeers([peerIndex], orgName)
		return instantiate(channel, peers, {
			chaincodeId, chaincodeVersion, fcn,
			args: JSON.parse(args)
		}).then((message) => {
			res.send(message)
		}).catch(err => {
			const { proposalResponses } = err
			if (proposalResponses) {
				errorSyntaxHandle(proposalResponses, res)
			} else {
				errorSyntaxHandle(err, res)
			}
		})
	})

})
// Invoke transaction on chaincode on target peers
app.post('/chaincode/invoke/:chaincodeId', (req, res) => {
	logger.debug('==================== INVOKE ON CHAINCODE ==================')
	const { chaincodeId } = req.params
	const { fcn, args, orgName, peerIndex, channelName } = req.body

	logger.debug({ chaincodeId, fcn, args, orgName, peerIndex, channelName })
	if (invalid.peer(res, { peerIndex, orgName })) return
	if (invalid.chaincodeId(res, { chaincodeId })) return
	if (invalid.channelName(res, { channelName })) return

	const client = helper.getClient()
	helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client)
		const peers = helper.newPeers([peerIndex], orgName)
		return invoke(channel, peers, {
			chaincodeId, fcn,
			args: JSON.parse(args)
		}).then((message) => {
			const payloads = reducer(message)
			res.json({
				req: {
					chaincodeId,
					fcn,
					channelName,
					orgName,
					peerIndex,
					args
				},
				payloads
			})
		}).catch(err => {
			const { proposalResponses } = err
			if (proposalResponses) {
				errorSyntaxHandle(proposalResponses, res)
			} else {
				errorSyntaxHandle(err, res)
			}
		})
	})

})
//  Query Get Block by BlockNumber
app.post('/query/block/height/:blockNumber', (req, res) => {
	logger.debug('==================== GET BLOCK BY NUMBER ==================')
	const { blockNumber } = req.params
	const { peerIndex, orgName, channelName } = req.body

	if (invalid.peer(res, { peerIndex, orgName })) return
	logger.debug({ blockNumber, peerIndex, orgName, channelName })

	const client = helper.getClient()
	helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client)
		const peer = helper.newPeers([peerIndex], orgName)[0]
		return Query.block.height(peer, channel, blockNumber).then((message) => {
			res.send(message)
		}).catch(err => {
			errorSyntaxHandle(err, res)
		})
	})

})
// Query Get Block by Hash
app.post('/query/block/hash', (req, res) => {
	logger.debug('================ GET BLOCK BY HASH ======================')
	const { hashHex, peerIndex, orgName, channelName } = req.body
	logger.debug({ hashHex, peerIndex, orgName, channelName })
	if (invalid.peer(res, { peerIndex, orgName })) return
	const client = helper.getClient()
	const peer = helper.newPeers([peerIndex], orgName)[0]
	helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client)
		return Query.block.hash(peer, channel, Buffer.from(hashHex, 'hex')).then((message) => {
			res.send(message)
		}).catch(err => {
			errorSyntaxHandle(err, res)
		})
	})

})
// Query Get Transaction by Transaction ID
app.post('/query/tx', (req, res) => {
	logger.debug('================ GET TRANSACTION BY TRANSACTION_ID ======================')
	const { txId, orgName, peerIndex, channelName } = req.body
	logger.debug({ txId, orgName, peerIndex, channelName })
	if (invalid.peer(res, { peerIndex, orgName })) return
	const client = helper.getClient()
	helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client)
		const peer = helper.newPeers([peerIndex], orgName)[0]
		return Query.tx(peer, channel, txId).then((message) => {
			res.send(message)
		}).catch(err => {
			errorSyntaxHandle(err, res)
		})
	})

})

//Query for Channel Information
//NOTE: blockchain is summary for all chaincode
app.post('/query/chain', (req, res) => {
	logger.debug('================ GET blockchain INFORMATION ======================')
	const { orgName, peerIndex, channelName } = req.body
	logger.debug({ orgName, peerIndex, channelName })
	if (invalid.peer(res, { peerIndex, orgName })) return
	const client = helper.getClient()
	helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client)
		const peer = helper.newPeers([peerIndex], orgName)[0]
		return Query.chain(peer, channel).then(
				(message) => {
					const { height, currentBlockHash, previousBlockHash } = message
					const Long = require('long')
					message.pretty = {
						height: new Long(height.low, height.high, height.unsigned).toInt(),
						currentBlockHash: currentBlockHash.toString('hex'),
						previousBlockHash: previousBlockHash.toString('hex')
					}
					//npm long:to parse{ low: 4, high: 0, unsigned: true }
					res.send(message)
				}).catch(err => {
			errorSyntaxHandle(err, res)
		})
	})

})
// Query to fetch all Installed/instantiated chaincodes
app.post('/query/chaincodes/installed', (req, res) => {
	logger.debug('==================== query installed CHAINCODE ==================')
	const { orgName, peerIndex } = req.body
	logger.debug({ orgName, peerIndex })
	const client = helper.getClient()
	if (invalid.peer(res, { peerIndex, orgName })) return

	const peer = helper.newPeers([peerIndex], orgName)[0]
	helper.getOrgAdmin(orgName, client).then(() => {
		return Query.chaincodes.installed(peer, client).then((message) => {
			res.send(message)
		})
	}).catch(err => {
		errorSyntaxHandle(err, res)
	})
})
app.post('/query/chaincodes/instantiated', (req, res) => {
	logger.debug('==================== query instantiated CHAINCODE ==================')
	const { orgName, peerIndex, channelName } = req.body
	logger.debug({ orgName, peerIndex, channelName })
	const client = helper.getClient()
	if (invalid.peer(res, { peerIndex, orgName })) return
	const peer = helper.newPeers([peerIndex], orgName)[0]
	helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client)
		return Query.chaincodes.instantiated(peer, channel).then((message) => {
			res.send(message)
		})
	}).catch(err => {
		errorSyntaxHandle(err, res)
	})
})
// Query to fetch channels
app.post('/query/channelJoined', (req, res) => {
	logger.debug('================ query joined CHANNELS ======================')
	const { orgName, peerIndex } = req.body
	logger.debug({ orgName, peerIndex })
	if (invalid.peer(res, { peerIndex, orgName })) return
	const client = helper.getClient()
	const peer = helper.newPeers([peerIndex], orgName)[0]
	helper.getOrgAdmin(orgName, client).then(() => {
		return Query.channel.joined(peer, client).then((
				message) => {
			res.send(message)
		})
	}).catch(err => {
		errorSyntaxHandle(err, res)
	})
})
//TODO ping docker container
