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
const WebSocket = require('ws')
const config = require('./app/config.json')
const companyConfig = require('./config/orgs.json').delphi
const channelsConfig = companyConfig.channels
const orgsConfig = companyConfig.orgs
const chaincodesConfig = require('./config/chaincode.json')
const CONFIGTXDir = companyConfig.docker.volumes.CONFIGTX.dir

const helper = require('./app/helper.js')
const ClientUtil = require('./app/util/client')
const createChannel = require('./app/create-channel').create
const joinChannel = require('./app/join-channel').joinChannel

const Query = require('./app/query')
const install = require('./app/install-chaincode.js').install
const { instantiate, upgrade } = require('./app/instantiate-chaincode.js')
const { reducer } = require('./app/util/chaincode')
const { invokeChaincode: invoke } = require('./app/invoke-chaincode.js')
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

const wss = new WebSocket.Server({ server })

wss.on('connection', (ws, req) => {
	const url = require('url')

	const location = url.parse(req.url, true)
	// You might use location.query.access_token to authenticate or share sessions
	// or req.headers.cookie (see http://stackoverflow.com/a/16395220/151312)

	const pathSplit = location.path.split('/')
	console.log(pathSplit)
	//[ '', 'chaincode', 'invoke', 'vendorChaincode' ]
	let messageCB = (message) => {
		console.log('received: %s', message)
		ws.send(JSON.stringify({ data: 'pong', status: 200 }), (err) => {
			if (err) {
				console.error(err)
			}
		})
	}
	const sendError = (error) => {
		ws.send(JSON.stringify({ data: error, status: 400 }), (err) => {
			if (err) {
				console.error(err)
			}
		})
	}

	if (pathSplit.length === 4) {
		switch (pathSplit[1]) {
			case 'chaincode':
				const chaincodeId = pathSplit[3]
				const invalidChaincodeId = invalid.chaincodeId({ chaincodeId })
				if (invalidChaincodeId) return sendError(invalidChaincodeId)
				switch (pathSplit[2]) {
					case 'invoke':
						messageCB = (message) => {
							logger.debug('==================== INVOKE CHAINCODE ==================')
							const { fcn, args: argsString, orgName, peerIndex, channelName } = JSON.parse(message)
							const args = JSON.parse(argsString)
							logger.debug({ chaincodeId, fcn, args, orgName, peerIndex, channelName })
							const invalidPeer = invalid.peer({ peerIndex, orgName })
							if (invalidPeer) return sendError(invalidPeer)

							const invalidChannelName = invalid.channelName({ channelName })
							if (invalidChannelName) return sendError(invalidChannelName)

							const invalidArgs = invalid.args({ args })
							if (invalidArgs) return sendError(invalidArgs)

							const client = ClientUtil.new()
							helper.getOrgAdmin(orgName, client).then(() => {
								const channel = helper.prepareChannel(channelName, client)
								const peers = helper.newPeers([peerIndex], orgName)
								return invoke(channel, peers, {
									chaincodeId, fcn,
									args
								}).then((message) => {
									const data = reducer(message)
									const sendContent = JSON.stringify({ data:data.responses, status: 200 })
									ws.send(sendContent, (err) => {
										if (err) {
											logger.error(err)
										}
									})

								}).catch(err => {
									logger.error(err)
									const { proposalResponses } = err
									if (proposalResponses) {
										ws.send(webSocketErrorFormat(proposalResponses), err => {
											if (err) {
												logger.error(err)
											}
										})
									} else {
										ws.send(webSocketErrorFormat(err), err => {
											if (err) {
												logger.error(err)
											}
										})
									}
								})
							})

						}
						break
					case 'instantiate':
						messageCB = (message) => {
							logger.debug('==================== INSTANTIATE CHAINCODE ==================')

							const { chaincodeVersion, channelName, fcn, args: argsString, peerIndex, orgName } = JSON.parse(message)
							const args = JSON.parse(argsString)
							logger.debug({ channelName, chaincodeId, chaincodeVersion, fcn, args, peerIndex, orgName })
							const invalidPeer = invalid.peer({ orgName, peerIndex })
							if (invalidPeer) return sendError(invalidPeer)

							const invalidChannelName = invalid.channelName({ channelName })
							if (invalidChannelName) return sendError(invalidChannelName)

							const invalidArgs = invalid.args({ args })
							if (invalidArgs) return sendError(invalidArgs)
							const client = ClientUtil.new()
							return helper.getOrgAdmin(orgName, client).then(() => {
								const channel = helper.prepareChannel(channelName, client)
								const peers = helper.newPeers([peerIndex], orgName)
								return instantiate(channel, undefined, {
									chaincodeId, chaincodeVersion, fcn,
									args
								}).then((_) => {
									const sendContent = JSON.stringify({ data:`instantiate request has been processed successfully with ${message}`, status: 200 })
									ws.send(sendContent, (err) => {
										if (err) {
											logger.error(err)
										}
									})
								}).catch(err => {
									const { proposalResponses } = err
									if (proposalResponses) {
										ws.send(webSocketErrorFormat(proposalResponses), err => {
											if (err) {
												logger.error(err)
											}
										})
									} else {
										ws.send(webSocketErrorFormat(err), err => {
											if (err) {
												logger.error(err)
											}
										})
									}
								})
							})
						}
						break
					case 'upgrade':
						messageCB = (message) => {
							logger.debug('==================== upgrade CHAINCODE ==================')

							const { chaincodeVersion, channelName, fcn, args: argsString, peerIndex, orgName } = JSON.parse(message)
							const args = JSON.parse(argsString)
							logger.debug({ channelName, chaincodeId, chaincodeVersion, fcn, args, peerIndex, orgName })
							const invalidPeer = invalid.peer({ orgName, peerIndex })
							if (invalidPeer) return sendError(invalidPeer)
							const invalidChannelName = invalid.channelName({ channelName })
							if (invalidChannelName) return sendError(invalidChannelName)

							const invalidArgs = invalid.args({ args })
							if (invalidArgs) return sendError(invalidArgs)
							const client = ClientUtil.new()
							helper.getOrgAdmin(orgName, client).then(() => {
								const channel = helper.prepareChannel(channelName, client)
								const peers = helper.newPeers([peerIndex], orgName)
								return upgrade(channel, undefined, {
									chaincodeId, chaincodeVersion, fcn,
									args
								}).then((_) => {
									const sendContent = JSON.stringify({ data:`upgrade request has been processed successfully with ${message}`, status: 200 })
									ws.send(sendContent, (err) => {
										if (err) {
											logger.error(err)
										}
									})
								}).catch(err => {
									const { proposalResponses } = err
									if (proposalResponses) {
										ws.send(webSocketErrorFormat(proposalResponses), err => {
											if (err) {
												logger.error(err)
											}
										})
									} else {
										ws.send(webSocketErrorFormat(err), err => {
											if (err) {
												logger.error(err)
											}
										})
									}
								})
							})
						}

						break
					default:

				}
				break
			default:
		}
	}

	ws.on('message', messageCB)

})

const invalid = {
	orgName: ({ orgName }) => {
		const orgConfig = orgsConfig[orgName]
		if (!orgConfig) {
			return `config of org '${orgName}' not found`
		}
		return false
	},
	channelName: ({ channelName }) => {
		const channelConfig = channelsConfig[channelName]
		if (!channelConfig) {
			return `config of channel '${channelName}' not found`
		}
		return false
	},
	peer: ({ orgName, peerIndex }) => {
		const invalidOrgname = invalid.orgName({ orgName })
		if (invalidOrgname) return invalidOrgname
		const orgConfig = orgsConfig[orgName]
		const peerConfig = orgConfig.peers[peerIndex]
		if (!peerConfig) {
			return `config of peer${peerIndex}.${orgName} not found`
		}
		return false
	},
	args: ({ args }) => {
		if (!Array.isArray(args)) {
			return `Arguments must be an array but got:${args}`
		}
		return false
	},
	chaincodeVersion: ({ chaincodeVersion }) => {
		//TODO
	},
	chaincodeId: ({ chaincodeId }) => {
		const chaincodeConfig = chaincodesConfig.chaincodes[chaincodeId]
		if (!chaincodeConfig) {
			return `config of chaincode ${chaincodeId} not found`
		}
		return false
	}
}
const errorCodeMap = {
	'BAD_REQUEST': 400,
	'FORBIDDEN': 403,
	'Failed to deserialize creator identity': 401,
	'NOT_FOUND': 404,
	'could not find': 404,
	'no such file or directory': 404,
	'not found': 404,
	'Connect Failed': 503,
	'Service Unavailable': 503

}
const errorSyntaxHandle = (err, res) => {
	const { data, status } = JSON.parse(webSocketErrorFormat(err))
	res.status(status)
	res.send(data)
}
const webSocketErrorFormat = (err) => {
	let status = 500
	for (let errorMessage in errorCodeMap) {
		if (err.toString().includes(errorMessage)) {
			status = errorCodeMap[errorMessage]
			break
		}
	}
	return JSON.stringify({ data: err.toString(), status })

}

// Create Channel
app.post('/channel/create/:channelName', (req, res) => {

	logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>')
	const { channelName } = req.params
	const { orgName } = req.body

	const invalidChannelName = invalid.channelName({ channelName })
	if (invalidChannelName) {
		res.send(invalidChannelName)
		return
	}
	const invalidOrgName = invalid.orgName({ orgName })
	if (invalidOrgName) {
		res.send(invalidOrgName)
		return
	}
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
		logger.error(err)
		errorSyntaxHandle(err, res)
	})
})
// Join Channel
app.post('/channel/join/:channelName', (req, res) => {
	logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>')
	const { channelName } = req.params

	const invalidChannelName = invalid.channelName({ channelName })
	if (invalidChannelName) {
		res.send(invalidChannelName)
		return
	}

	const { orgName, peerIndex } = req.body
	logger.debug({ channelName, orgName, peerIndex })

	const invalidPeer = invalid.peer({ orgName, peerIndex })
	if (invalidPeer) {
		res.send(invalidPeer)
		return
	}

	const peers = helper.newPeers([peerIndex], orgName)

	const client = ClientUtil.new()
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

	const invalidChaincodeId = invalid.chaincodeId({ chaincodeId })
	if (invalidChaincodeId) {
		res.send(invalidChaincodeId)
		return
	}
	const invalidPeer = invalid.peer({ orgName, peerIndex })
	if (invalidPeer) {
		res.send(invalidPeer)
		return
	}
	const chaincodeConfig = chaincodesConfig.chaincodes[chaincodeId]
	const chaincodePath = chaincodeConfig.path

	const peers = helper.newPeers([peerIndex], orgName)
	//TODO to test ChaincodeVersion

	helper.setGOPATH()
	const client = ClientUtil.new()
	helper.getOrgAdmin(orgName, client).then(() => {
		return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client).
				then((message) => {
					res.send(
							`install chaincode ${chaincodeId} of version ${chaincodeVersion} to peer${peerIndex}.${orgName} successfully`)
				})
	})

})
//  Query Get Block by BlockNumber
app.post('/query/block/height/:blockNumber', (req, res) => {
	logger.debug('==================== GET BLOCK BY NUMBER ==================')
	const { blockNumber } = req.params
	const { peerIndex, orgName, channelName } = req.body

	const invalidPeer = invalid.peer({ orgName, peerIndex })
	if (invalidPeer) {
		res.send(invalidPeer)
		return
	}
	logger.debug({ blockNumber, peerIndex, orgName, channelName })

	const client = ClientUtil.new()
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
	const invalidPeer = invalid.peer({ orgName, peerIndex })
	if (invalidPeer) {
		res.send(invalidPeer)
		return
	}
	const client = ClientUtil.new()
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
	const invalidPeer = invalid.peer({ orgName, peerIndex })
	if (invalidPeer) {
		res.send(invalidPeer)
		return
	}
	const client = ClientUtil.new()
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

	const invalidPeer = invalid.peer({ orgName, peerIndex })
	if (invalidPeer) {
		res.send(invalidPeer)
		return
	}
	const client = ClientUtil.new()
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
	const client = ClientUtil.new()
	const invalidPeer = invalid.peer({ orgName, peerIndex })
	if (invalidPeer) {
		res.send(invalidPeer)
		return
	}

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
	const client = ClientUtil.new()
	const invalidPeer = invalid.peer({ orgName, peerIndex })
	if (invalidPeer) {
		res.send(invalidPeer)
		return
	}
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
	const invalidPeer = invalid.peer({ orgName, peerIndex })
	if (invalidPeer) {
		res.send(invalidPeer)
		return
	}
	const client = ClientUtil.new()
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
