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
const logger = log4js.getLogger('Helper')
logger.setLevel('DEBUG')

const path = require('path')
const util = require('util')
const fs = require('fs-extra')
const User = require('fabric-client/lib/User.js')
const caService = require('fabric-ca-client')
const config = require('../config.json')
const globalConfig = require('../config/orgs.json')
const COMPANY = 'delphi'
const companyConfig = globalConfig[COMPANY]
const CRYPTO_CONFIG_DIR = companyConfig.CRYPTO_CONFIG_DIR
const channelsConfig = companyConfig.channels
const chaincodeConfig = require('../config/chaincode.json')
const hfc = require('fabric-client')

const testConfig = require('../config/node-sdk/test.json')

const orgsConfig = companyConfig.orgs
const COMPANY_DOMAIN = companyConfig.domain
const clients = {} // client is for save CryptoSuite for each org
const channels = {}
const caClients = {}

// set up the client and channel objects for each org
const GPRC_PROTOCAL = 'grpcs://' // FIXME: assume using TLS
const gen_tls_cacerts = function(orgName, peerIndex) {
	const org_domain = `${orgName.toLowerCase()}.${COMPANY_DOMAIN}`// bu.delphi.com
	const peer_hostName_full = `peer${peerIndex}.${org_domain}`
	const tls_cacerts = `${CRYPTO_CONFIG_DIR}/peerOrganizations/${org_domain}/peers/${peer_hostName_full}/tls/ca.crt`
	return { org_domain, peer_hostName_full, tls_cacerts }
}
const newPeer = function(orgName, peerIndex, peerPortMap, client) {
	let _client = client ? client : getClientForOrg(orgName)
	if (!_client) {
		logger.error(`client for org :${orgName} not found`)
		return {}
	}
	const { peer_hostName_full, tls_cacerts } = gen_tls_cacerts(orgName, peerIndex)
	let requests
	for (let portMapEach of peerPortMap) {
		if (portMapEach.container === 7051) {
			requests = `${GPRC_PROTOCAL}localhost:${portMapEach.host}`
		}
	}
	if (!requests) {
		logger.warn(`Could not find port mapped to 7051 for peer host==${peer_hostName_full}`)
		return {}
	}
	let data = fs.readFileSync(tls_cacerts)
	return _client.newPeer(requests, {
		pem: Buffer.from(data).toString(),
		'ssl-target-name-override': peer_hostName_full,
	})
}

for (let orgName in orgsConfig) {
	let client = new hfc()
	const org = orgsConfig[orgName]
	let cryptoSuite = hfc.newCryptoSuite()

	//NOTE keyStore opts:
	//		for couchdb: {name:dbname,url:couchdbIPAddr +':'+ couchdbPort }
	//		for create user: {path: store path}
	cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({ path: getKeyStorePath(orgName) }))
	client.setCryptoSuite(cryptoSuite)

	//add orderer
	const ordererConfig = {}
	const orderer_hostName = companyConfig.orderer.containerName.toLowerCase()
	const orderer_hostName_full = `${orderer_hostName}.${COMPANY_DOMAIN}`

	ordererConfig.tls_cacerts = `${CRYPTO_CONFIG_DIR}/ordererOrganizations/${COMPANY_DOMAIN}/orderers/${orderer_hostName_full}/tls/ca.crt`

	for (let portMapEach of companyConfig.orderer.portMap) {
		if (portMapEach.container === 7050) {
			ordererConfig.url = `${GPRC_PROTOCAL}localhost:${portMapEach.host}`
		}
	}

	for (let channelName in channelsConfig) {

		const channel = client.newChannel(channelName)

		const data = fs.readFileSync(ordererConfig.tls_cacerts)
		const orderer = client.newOrderer(ordererConfig.url, {
			'pem': Buffer.from(data).toString(),
			'ssl-target-name-override': orderer_hostName_full,
		})

		channel.addOrderer(orderer) //FIXME client-side-only operation?
		for (let peerIndex in org.peers) {
			const peerConfig = org.peers[peerIndex]

			let peer = newPeer(orgName, peerIndex, peerConfig.portMap, client)
			channel.addPeer(peer) //FIXME client-side-only operation? Found: without container-side 'peer channel join', install chaincode still OK

		}
		channels[orgName] = channel//TODO refactor design
	}

	clients[orgName] = client

	let ca_port
	for (let portMapEach of org.ca.portMap) {
		if (portMapEach.container === 7054) {
			ca_port = portMapEach.host
		}
	}
	const caUrl = `https://localhost:${ca_port}`
	caClients[orgName] = new caService(caUrl, null /*defautl TLS opts*/, '' /* default CA */, cryptoSuite)
}

function readAllFiles (dir) {
	const files = fs.readdirSync(dir)
	const certs = []
	files.forEach((file_name) => {
		let file_path = path.join(dir, file_name)
		let data = fs.readFileSync(file_path)
		certs.push(data)
	})
	return certs
}

function getKeyStorePath (org) {
	return `/tmp/fabric-client-kvs_${org}`
}

//-------------------------------------//
// APIs
//-------------------------------------//
var getChannelForOrg = function(org) {
	return channels[org]
}

var getClientForOrg = function(org) {
	return clients[org]
}

const queryOrgName = function(containerName) {
	//FIXME for loop search
	const orgsConfig = companyConfig.orgs
	for (let orgName in orgsConfig) {
		const orgBody = orgsConfig[orgName]
		const peers = orgBody.peers
		for (let index in peers) {
			const peer = peers[index]
			if (peer.containerName === containerName) {
				return {
					key: orgName, peer: {
						index: index, value: peer,
					},
				}
			}
		}
	}
}

const newPeers = function(containerNames) {
	const targets = []
	// find the peer that match the urls

	for (let containerName of containerNames) {

		const { key: orgName, peer: { index: index, value: peerConfig } } = queryOrgName(containerName)
		if (!orgName) {
			logger.warn(`Could not find OrgName for containerName ${containerName}`)
			continue
		}
		const _newPeer = newPeer(orgName, index, peerConfig.portMap)
		targets.push(_newPeer)
	}

	if (targets.length === 0) {
		logger.error(`Failed to find any peer for containers ${containerNames}`)
	}

	return targets
}

const newEventHub = function(orgName, peerIndex, peerPortMap, client) {
	let _client = client ? client : getClientForOrg(orgName)
	if (!_client) {
		logger.error(`client for org :${orgName} not found`)
		return {}
	}

	const { peer_hostName_full, tls_cacerts } = gen_tls_cacerts(orgName, peerIndex)
	let events
	for (let portMapEach of peerPortMap) {
		if (portMapEach.container === 7053) {
			events = `${GPRC_PROTOCAL}localhost:${portMapEach.host}`
		}
	}
	if (!events) {
		logger.warn(`Could not find port mapped to 7053 for peer host==${peer_hostName_full}`)
		return {}
	}
	const eh = _client.newEventHub()
	let data = fs.readFileSync(tls_cacerts)
	eh.setPeerAddr(events, {
		pem: Buffer.from(data).toString(),
		'ssl-target-name-override': peer_hostName_full,
	})

}
//FIXME to test: used in invoke chaincode
const newEventHubs = function(containerNames) {
	const targets = []
	// find the peer that match the urls
	for (let containerName of containerNames) {

		// if looking for event hubs, an app can only connect to
		// event hubs in its own org
		const { key: orgName, peer: { index: index, value: peerConfig } } = queryOrgName(containerName)
		if (!orgName) {
			logger.warn(`Could not find OrgName for containerName ${containerName}`)
			continue
		}
		const eh = newEventHub(orgName, index, peerConfig.portMap)
		targets.push(eh)

	}

	if (targets.length === 0) {
		logger.error(`Failed to find any peer for urls ${urls}`)
	}

	return targets
}

const getMspID = function(org) {
	const mspid = orgsConfig[org].MSP.id
	logger.debug(`Msp ID : ${mspid}`)
	return mspid
}

var getAdminUser = function(userOrg) {
	var users = config.users
	var username = users[0].username
	var password = users[0].secret
	var member
	var client = getClientForOrg(userOrg)

	return hfc.newDefaultKeyValueStore({
		path: getKeyStorePath(userOrg),
	}).then((store) => {
		client.setStateStore(store)
		// clearing the user context before switching
		client._userContext = null
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence')
				return user
			} else {
				let caClient = caClients[userOrg]
				// need to enroll it with CA server
				return caClient.enroll({
					enrollmentID: username,
					enrollmentSecret: password,
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

var getRegisteredUsers = function(username, userOrg, isJson) {
	var member
	var client = getClientForOrg(userOrg)
	var enrollmentSecret = null
	return hfc.newDefaultKeyValueStore({
		path: getKeyStorePath(userOrg),
	}).then((store) => {
		client.setStateStore(store)
		// clearing the user context before switching
		client._userContext = null
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence')
				return user
			} else {
				let caClient = caClients[userOrg]
				return getAdminUser(userOrg).then(function(adminUserObj) {
					member = adminUserObj
					return caClient.register({
						enrollmentID: username,
						affiliation: userOrg + '.department1',
					}, member)
				}).then((secret) => {
					enrollmentSecret = secret
					logger.debug(username + ' registered successfully')
					return caClient.enroll({
						enrollmentID: username,
						enrollmentSecret: secret,
					})
				}, (err) => {
					logger.debug(username + ' failed to register')
					return '' + err
					//return 'Failed to register '+username+'. Error: ' + err.stack ? err.stack : err;
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
				}, (err) => {
					logger.error(util.format('%s enroll failed: %s', username, err.stack ? err.stack : err))
					return '' + err
				})

			}
		})
	}).then((user) => {
		if (isJson && isJson === true) {
			var response = {
				success: true,
				secret: user._enrollmentSecret,
				message: username + ' enrolled Successfully',
			}
			return response
		}
		return user
	}, (err) => {
		logger.error(util.format('Failed to get registered user: %s, error: %s', username, err.stack ? err.stack : err))
		return '' + err
	})
}

const getOrgAdmin = function(orgName) {
	const org_domain = `${orgName.toLowerCase()}.${COMPANY_DOMAIN}`// bu.delphi.com
	const key = `${CRYPTO_CONFIG_DIR}/peerOrganizations/${org_domain}/users/Admin@${org_domain}/msp/keystore`
	const cert = `${CRYPTO_CONFIG_DIR}/peerOrganizations/${org_domain}/users/Admin@${org_domain}/msp/signcerts`

	var keyPEM = Buffer.from(readAllFiles(key)[0]).toString()
	var certPEM = readAllFiles(cert)[0].toString()

	var client = getClientForOrg(orgName)
	var cryptoSuite = hfc.newCryptoSuite()
	if (orgName) {
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({ path: getKeyStorePath(orgName) }))
		client.setCryptoSuite(cryptoSuite)
	}

	return hfc.newDefaultKeyValueStore({
		path: getKeyStorePath(orgName),
	}).then((store) => {
		client.setStateStore(store)

		// NOTE:(jsdoc) This allows applications to use pre-existing crypto materials (private keys and certificates) to construct user objects with signing capabilities
		return client.createUser({
			username: 'peer' + orgName + 'Admin',
			mspid: getMspID(orgName),
			cryptoContent: {
				privateKeyPEM: keyPEM,
				signedCertPEM: certPEM,
			},
		})
	})
}

const setGOPATH = function() {
	process.env.GOPATH = chaincodeConfig.GOPATH
}

var getLogger = function(moduleName) {
	var logger = log4js.getLogger(moduleName)
	logger.setLevel('DEBUG')
	return logger
}

var getPeerAddressByName = function(org, peer) {
	//FIXME remaining rely on testConfig
	var address = testConfig[org][peer].requests
	return address.split('grpcs://')[1] // localhost:7051
}

exports.getChannelForOrg = getChannelForOrg
exports.getClientForOrg = getClientForOrg
exports.getLogger = getLogger
exports.setGOPATH = setGOPATH
exports.getMspID = getMspID

exports.ORGS = Object.assign({ COMPANY }, globalConfig)
exports.queryOrgName = queryOrgName
exports.gen_tls_cacerts = gen_tls_cacerts
exports.newPeers = newPeers
exports.newEventHubs = newEventHubs
exports.getPeerAddressByName = getPeerAddressByName //see in query
exports.getRegisteredUsers = getRegisteredUsers //see in invoke
exports.getOrgAdmin = getOrgAdmin
