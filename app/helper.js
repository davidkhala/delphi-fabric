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
const log4js = require('log4js')
const getLogger = function(moduleName) {
	const logger = log4js.getLogger(moduleName)
	logger.setLevel('DEBUG')
	return logger
}
const logger = getLogger('Helper')

const path = require('path')
const fs = require('fs-extra')
const User = require('fabric-client/lib/User.js')
const caService = require('fabric-ca-client')
const globalConfig = require('../config/orgs.json')
const COMPANY = 'delphi'
const companyConfig = globalConfig[COMPANY]
const orgsConfig = companyConfig.orgs
const CRYPTO_CONFIG_DIR = companyConfig.CRYPTO_CONFIG_DIR
const channelsConfig = companyConfig.channels
const COMPANY_DOMAIN = companyConfig.domain
const chaincodeConfig = require('../config/chaincode.json')
const Client = require('fabric-client')
const sdkUtils = require('fabric-client/lib/utils')
const nodeConfig = require('./config.json')

const Orderer = require('fabric-client/lib/Orderer')
const Peer = require('fabric-client/lib/Peer')
const objects = { user: {}, orderer: {}, caService: {} } // client is for save CryptoSuite for each org??

// set up the client and channel objects for each org
const GPRC_protocol = 'grpcs://' // FIXME: assume using TLS
const gen_tls_cacerts = (orgName, peerIndex) => {
	const org_domain = `${orgName.toLowerCase()}.${COMPANY_DOMAIN}`// bu.delphi.com
	const peer_hostName_full = `peer${peerIndex}.${org_domain}`
	const tls_cacerts = `${CRYPTO_CONFIG_DIR}/peerOrganizations/${org_domain}/peers/${peer_hostName_full}/tls/ca.crt`
	return { org_domain, peer_hostName_full, tls_cacerts }
}
const newPeer = (orgName, peerIndex, peerPortMap) => {
	const { peer_hostName_full, tls_cacerts } = gen_tls_cacerts(orgName, peerIndex)
	let requests
	for (let portMapEach of peerPortMap) {
		if (portMapEach.container === 7051) {
			requests = `${GPRC_protocol}localhost:${portMapEach.host}`
		}
	}
	if (!requests) {
		logger.warn(`Could not find port mapped to 7051 for peer host==${peer_hostName_full}`)
		throw new Error(`Could not find port mapped to 7051 for peer host==${peer_hostName_full}`)
	}
	let data = fs.readFileSync(tls_cacerts)
	return new Peer(requests, {
		pem: Buffer.from(data).toString(),
		'ssl-target-name-override': peer_hostName_full
	})
}

//FIXME assume we have only one orderer

const ordererConfig = companyConfig.orderer
const orderer_hostName = ordererConfig.containerName.toLowerCase()
const orderer_hostName_full = `${orderer_hostName}.${COMPANY_DOMAIN}`
const orderer_tls_cacerts = path.join(CRYPTO_CONFIG_DIR,
		`ordererOrganizations/${COMPANY_DOMAIN}/orderers/${orderer_hostName_full}/tls/ca.crt`)
let orderer_url
for (let portMapEach of companyConfig.orderer.portMap) {
	if (portMapEach.container === 7050) {
		orderer_url = `${GPRC_protocol}localhost:${portMapEach.host}`
	}
}
//NOTE orderer without newCryptoSuite()
objects.orderer = new Orderer(orderer_url, {
	'pem': Buffer.from(fs.readFileSync(orderer_tls_cacerts)).toString(),
	'ssl-target-name-override': orderer_hostName_full
})

const client = new Client()
// @param {Object} setting This optional parameter is an object with the following optional properties:
// 	- software {boolean}: Whether to load a software-based implementation (true) or HSM implementation (false)
//		default is true (for software based implementation), specific implementation module is specified
//		in the setting 'crypto-suite-software'
//  - keysize {number}: The key size to use for the crypto suite instance. default is value of the setting 'crypto-keysize'
//  - algorithm {string}: Digital signature algorithm, currently supporting ECDSA only with value "EC"
//  - hash {string}: 'SHA2' or 'SHA3'

for (let channelName in channelsConfig) {
	const channelConfig = channelsConfig[channelName]
	const channel = client.newChannel(channelName.toLowerCase())
	channel.addOrderer(objects.orderer) //FIXME client-side-only operation?
	for (let orgName in channelConfig.orgs) {
		const orgConfigInChannel = channelConfig.orgs[orgName]
		for (let peerIndex of orgConfigInChannel.peerIndexes) {
			const peerConfig = orgsConfig[orgName].peers[peerIndex]

			let peer = newPeer(orgName, peerIndex, peerConfig.portMap)
			//NOTE append more info
			peer.peerConfig = peerConfig
			channel.addPeer(peer) //FIXME client-side-only operation? Found: without container-side 'peer channel join', install chaincode still OK
		}
	}

}

for (let orgName in orgsConfig) {
	const orgConfig = orgsConfig[orgName]

	let ca_port
	for (let portMapEach of orgConfig.ca.portMap) {
		if (portMapEach.container === 7054) {
			ca_port = portMapEach.host
		}
	}
	if (!ca_port) continue
	const caUrl = `https://localhost:${ca_port}`
	objects.caService[orgName] = new caService(caUrl, null /*defautl TLS opts*/, null /* default CA */, null
			/* default cryptoSuite */)

}

//state DB is designed for caching heavy-weight User object,
// client.getUserContext() will first query existence in cache first
//TODO to test use unified dir
const getStateDBCachePath = () => {
	return nodeConfig.stateDBCacheDir
}

const getChannel = function(channelName) {
	const channel = client.getChannel(channelName.toLowerCase())
	channel.eventWaitTime = channelsConfig[channelName].eventWaitTime
	channel.orgs=channelsConfig[channelName].orgs
	return channel
}

const getCaService = function(org) {
	return objects.caService[org]
}
// a data adapter, containerName=>key: orgName, peer: {index: index, value: peer, peer_hostName_full}
const queryPeer = function(containerName) {
	//FIXME for loop search
	for (let orgName in orgsConfig) {
		const orgBody = orgsConfig[orgName]
		const peers = orgBody.peers
		for (let index in peers) {
			const peer = peers[index]
			if (peer.containerName === containerName) {
				const org_domain = `${orgName.toLowerCase()}.${COMPANY_DOMAIN}`
				const peer_hostName_full = `peer${index}.${org_domain}`
				return {
					key: orgName, peer: {
						index: index, value: peer, peer_hostName_full
					}
				}
			}
		}
	}
}

// work as a data adapter, containerNames: array --> orgname,peerIndex,peerConfig for each newPeer
const newPeers = function(peerIndexes, orgName) {
	const targets = []
	// find the peer that match the urls

	for (let index of peerIndexes) {
		const peerConfig = orgsConfig[orgName].peers[index]
		if (!peerConfig) continue
		targets.push(newPeer(orgName, index, peerConfig.portMap))
	}

	return targets
}
// return undefined when invalid portmap
const newEventHub = function(orgName, peerIndex, peerPortMap, client) {

	const { peer_hostName_full, tls_cacerts } = gen_tls_cacerts(orgName, peerIndex)
	let events
	for (let portMapEach of peerPortMap) {
		if (portMapEach.container === 7053) {
			events = `${GPRC_protocol}localhost:${portMapEach.host}`
		}
	}
	if (!events) {
		throw new Error(`Could not find port mapped to 7053 for peer host==${peer_hostName_full}`)
	}
	const eventHub = client.newEventHub()// NOTE newEventHub binds to clientContext
	let data = fs.readFileSync(tls_cacerts)
	eventHub.setPeerAddr(events, {
		pem: Buffer.from(data).toString(),
		'ssl-target-name-override': peer_hostName_full
	})
	return eventHub

}

const newEventHubs = function(peerIndexes, orgName) {
	const targets = []
	for (let index of peerIndexes) {
		const peerConfig = orgsConfig[orgName].peers[index]
		if (!peerConfig) continue
		targets.push(newEventHub(orgName, index, peerConfig.portMap, client))
	}

	return targets
}

const getMspID = function(org) {
	const mspid = orgsConfig[org].MSP.id
	logger.debug(`Msp ID : ${mspid}`)
	return mspid
}

var getAdminUser = function(userOrg) {
	const username = 'admin'
	const password = 'adminpw'
	var member

	return sdkUtils.newKeyValueStore({
		path: getStateDBCachePath(userOrg)
	}).then((store) => {
		client.setStateStore(store)
		// clearing the user context before switching
		client._userContext = null
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence')
				return user
			} else {
				const caService = getCaService(userOrg)
				// need to enroll it with CA server
				return caService.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					logger.info('Successfully enrolled user \'' + username + '\'')
					member = new User(username)
					member.setCryptoSuite(client.getCryptoSuite())
					return member.setEnrollment(enrollment.key, enrollment.certificate, getMspID(userOrg))
				}).then(() => {
					return client.setUserContext(member)
				}).then(() => {
					return member
				}).catch((err) => {
					logger.error('Failed to enroll and persist user. Error: ' + err.stack ? err.stack : err)
					return null
				})
			}
		})
	})
}

//TODO using fabric-ca, skip it first
var getRegisteredUsers = function(username, userOrg, isJson) {
	var member
	var enrollmentSecret = null
	return sdkUtils.newKeyValueStore({
		path: getStateDBCachePath(userOrg)
	}).then((store) => {
		client.setStateStore(store)
		// clearing the user context before switching
		client._userContext = null
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence')
				return user
			} else {
				let caClient = getCaService(userOrg)
				return getAdminUser(userOrg).then(function(adminUserObj) {
					member = adminUserObj
					return caClient.register({
						enrollmentID: username,
						affiliation: userOrg + '.department1'
					}, member)
				}).then((secret) => {
					enrollmentSecret = secret
					logger.debug(username + ' registered successfully')
					return caClient.enroll({
						enrollmentID: username,
						enrollmentSecret: secret
					})
				}).then((message) => {
					if (message && typeof message === 'string' && message.includes(
									'Error:')) {
						logger.error(username + ' enrollment failed')
						return message
					}
					logger.debug(username + ' enrolled successfully')

					member = new User(username)
					member._enrollmentSecret = enrollmentSecret
					return member.setEnrollment(message.key, message.certificate, getMspID(userOrg))
				}).then(() => {
					client.setUserContext(member)
					return member
				})

			}
		})
	}).then((user) => {
		if (isJson && isJson === true) {
			var response = {
				success: true,
				secret: user._enrollmentSecret,
				message: username + ' enrolled Successfully'
			}
			return response
		}
		return user
	}).catch(err => {
		logger.error(err)
		//FIXME: fabric-ca request register failed with errors [[{"code":0,"message":"Failed getting affiliation 'PM.department1': sql: no rows in result set"}]]
	})
}

//NOTE have to do this since filename for private Key file would be liek
// a4fbafa51de1161a2f82ffa80cf1c34308482c33a9dcd4d150183183d0a3e0c6_sk
const getKeyFilesInDir = (dir) => {
	const files = fs.readdirSync(dir)
	const keyFiles = []
	files.forEach((file_name) => {
		let filePath = path.join(dir, file_name)
		if (file_name.endsWith('_sk')) {
			keyFiles.push(filePath)
		}
	})
	return keyFiles
}
objects.user.clear = () => {
	client._userContext = null
	client.setCryptoSuite(null)
}
const formatUsername = (username, orgName) => `${username}@${orgName.toLowerCase()}.${COMPANY_DOMAIN}`
//
objects.user.create = (keystoreDir, signcertFile, username, orgName, persistInCache = true, mspName) => {
	const keyFile = getKeyFilesInDir(keystoreDir)[0]
	// NOTE:(jsdoc) This allows applications to use pre-existing crypto materials (private keys and certificates) to construct user objects with signing capabilities
	// NOTE In client.createUser option, two types of cryptoContent is supported:
	// 1. cryptoContent: {		privateKey: keyFilePath,signedCert: certFilePath}
	// 2. cryptoContent: {		privateKeyPEM: keyFileContent,signedCertPEM: certFileContent}

	const createUserOpt = {
		username: formatUsername(username, orgName),
		mspid: mspName ? mspName : getMspID(orgName),
		cryptoContent: { privateKey: keyFile, signedCert: signcertFile }
	}
	if (persistInCache) {
		return sdkUtils.newKeyValueStore({
			path: getStateDBCachePath(orgName)
		}).then((store) => {
			client.setStateStore(store)

			return client.createUser(createUserOpt)
		})
	} else {
		return client.createUser(createUserOpt)
	}
}
/**
 * search in stateStore first, if not exist, then query state db to get cached user object
 *
 * @returns {Promise} A Promise for a {User} object
 * @param username
 * @param orgName
 */
objects.user.get = (username, orgName) => {
	const newKVS = () => sdkUtils.newKeyValueStore({
		path: getStateDBCachePath(orgName)
	}).then((store) => {
		client.setStateStore(store)
		return client.getUserContext(formatUsername(username, orgName), true)
	})
	if (client.getStateStore()) {
		return client.loadUserFromStateStore(formatUsername(username, orgName)).then(user => {
			if (user) return user
			return newKVS()
		})
	} else {
		return newKVS()
	}
}

const rawAdminUsername = 'adminName'

objects.user.admin = {
	orderer: {
		select: (ordererContainerName = 'ordererContainerName') => {

			const rawOrdererUsername = 'ordererAdminName'

			const keystoreDir = path.join(CRYPTO_CONFIG_DIR,
					`ordererOrganizations/${COMPANY_DOMAIN}/users/Admin@${COMPANY_DOMAIN}/msp/keystore`)
			const signcertFile = path.join(CRYPTO_CONFIG_DIR,
					`ordererOrganizations/${COMPANY_DOMAIN}/users/Admin@${COMPANY_DOMAIN}/msp/signcerts/Admin@${COMPANY_DOMAIN}-cert.pem`)
			const ordererMSPID = ordererConfig.MSP.id
			objects.user.clear()

			return objects.user.get(rawOrdererUsername, ordererContainerName).then(user => {
				if (user) return client.setUserContext(user, false)
				return objects.user.create(keystoreDir, signcertFile, rawOrdererUsername, ordererContainerName, true,
						ordererMSPID)
			})
		}
	}
}
objects.user.admin.get = (orgName) => objects.user.get(rawAdminUsername, orgName)
objects.user.admin.create = (orgName) => {

	const org_domain = `${orgName.toLowerCase()}.${COMPANY_DOMAIN}`// bu.delphi.com
	const keystoreDir = path.join(CRYPTO_CONFIG_DIR,
			`peerOrganizations/${org_domain}/users/Admin@${org_domain}/msp/keystore`)

	const signcertFile = path.join(CRYPTO_CONFIG_DIR,
			`peerOrganizations/${org_domain}/users/Admin@${org_domain}/msp/signcerts/Admin@${org_domain}-cert.pem`)

	return objects.user.create(keystoreDir, signcertFile, rawAdminUsername, orgName)
}
//
objects.user.createIfNotExist = (keystoreDir, signcertFile, username, orgName) => {
	objects.user.get(username, orgName).then(user => {
		if (user) return client.setUserContext(user, false)
		return objects.user.create(keystoreDir, signcertFile, username, orgName)
	})
}
objects.user.select = (keystoreDir, signcertFile, username, orgName) => {
	objects.user.clear()
	return objects.user.createIfNotExist(keystoreDir, signcertFile, username, orgName)
}
objects.user.admin.createIfNotExist = (orgName) => objects.user.admin.get(orgName).then(user => {
	if (user) return client.setUserContext(user, false)
	return objects.user.admin.create(orgName)
})
objects.user.admin.select = (orgName) => {
	objects.user.clear()
	return objects.user.admin.createIfNotExist(orgName)
}

const setGOPATH = function() {
	process.env.GOPATH = chaincodeConfig.GOPATH
}

const newPeerByContainer = (containerName) => {
	const { key: orgName, peer: { index: index, value: peerConfig } } = queryPeer(containerName)
	if (!orgName) {
		logger.warn(`Could not find OrgName for containerName ${containerName}`)
		throw new Error(`Could not find OrgName for containerName ${containerName}`)
	}
	return newPeer(orgName, index, peerConfig.portMap)
}

exports.sendProposalCommonPromise = (channel, request, txId, fnName) => {
	return new Promise((resolve, reject) => {
		channel[fnName](request).then(([responses, proposal, header]) => {
			//data transform

			for (let i in responses) {
				const proposalResponse = responses[i]
				if (proposalResponse.response &&
						proposalResponse.response.status === 200) {
					logger.info(`${fnName} was good for [${i}]`, proposalResponse)
				} else {
					logger.error(`${fnName} was bad for [${i}], Response null or status is not 200.`
							, proposalResponse)
					reject(responses)
					return
					//	error symptons:{
					// Error: premature execution - chaincode (delphiChaincode:v1) is being launched
					// at /home/david/Documents/delphi-fabric/node_modules/grpc/src/node/src/client.js:434:17 code: 2, metadata: Metadata { _internal_repr: {} }}

				}
			}
			resolve({
				txId,
				nextRequest: {
					proposalResponses: responses, proposal
				}
			})

		})
	})
}

exports.getChannel = getChannel
exports.getClient = () => client
exports.getLogger = getLogger
exports.setGOPATH = setGOPATH

exports.helperConfig = Object.assign({ COMPANY }, { GPRC_protocol }, globalConfig)
exports.queryPeer = queryPeer
exports.gen_tls_cacerts = gen_tls_cacerts
exports.newPeers = newPeers
exports.newPeerByContainer = newPeerByContainer
exports.userAction = objects.user
exports.newEventHubs = newEventHubs
exports.newEventHub = newEventHub
exports.getRegisteredUsers = getRegisteredUsers //see in invoke
exports.getOrgAdmin = objects.user.admin.select
exports.getCaService = getCaService
