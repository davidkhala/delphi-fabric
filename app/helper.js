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
const crypto = require('crypto')
const copService = require('fabric-ca-client')
const config = require('../config.json')
const glocalConfig = require('../config/orgs.json')
const channelsConfig = glocalConfig.delphi.channels
const chaincodeConfig=require('../config/chaincode.json')
const hfc = require('fabric-client')

const testConfig = require('../config/node-sdk/test.json')

const ordererConfig = testConfig.orderer
const orgsConfig = testConfig.organizations
const clients = {} // client is for save CryptoSuite for each org
const channels = {}
const caClients = {}

// set up the client and channel objects for each org

for (let orgName in orgsConfig) {
	let client = new hfc()
	const org = orgsConfig[orgName]
	let cryptoSuite = hfc.newCryptoSuite()

	//NOTE keyStore opts:
	//		for couchdb: {name:dbname,url:couchdbIPAddr +':'+ couchdbPort }
	//		for create user: {path: store path}
	cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({ path: getKeyStorePath(orgName) }))
	client.setCryptoSuite(cryptoSuite)

	for (let channelName in channelsConfig) {

		let channel = client.newChannel(channelName)

		//add orderer
		const caRootsPath = ordererConfig.tls_cacerts
		let data = fs.readFileSync(caRootsPath)
		const orderer = client.newOrderer(ordererConfig.url, {
			'pem': Buffer.from(data).toString(),
			'ssl-target-name-override': ordererConfig.serverHostName,
		})

		channel.addOrderer(orderer)
		for (let peerContainer of org.peers) {

			let data = fs.readFileSync(peerContainer.tls_cacerts)
			const opts = {
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': peerContainer.serverHostName,
			}
			let peer = client.newPeer(peerContainer.requests, opts)
			channel.addPeer(peer) //FIXME will it work?

		}
		channels[orgName] = channel//TODO refactor design
	}

	clients[orgName] = client

	const caUrl = org.ca
	caClients[orgName] = new copService(caUrl, null /*defautl TLS opts*/, '' /* default CA */, cryptoSuite)
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

function newRemotes (urls, forPeers, userOrg) {
	var targets = []
	// find the peer that match the urls
	outer:
			for (let index in urls) {
				let peerUrl = urls[index]

				let found = false
				for (let key in testConfig) {
					if (key.indexOf('org') === 0) {
						// if looking for event hubs, an app can only connect to
						// event hubs in its own org
						if (!forPeers && key !== userOrg) {
							continue
						}

						let org = testConfig[key]
						let client = getClientForOrg(key)

						for (let prop in org) {
							if (prop.indexOf('peer') === 0) {
								if (org[prop]['requests'].indexOf(peerUrl) >= 0) {
									// found a peer matching the subject url
									if (forPeers) {
										let data = fs.readFileSync(org[prop].tls_cacerts)
										targets.push(client.newPeer('grpcs://' + peerUrl, {
											pem: Buffer.from(data).toString(),
											'ssl-target-name-override': org[prop].serverHostName,
										}))

										continue outer
									} else {
										let eh = client.newEventHub()
										let data = fs.readFileSync(org[prop].tls_cacerts)
										eh.setPeerAddr(org[prop]['events'], {
											pem: Buffer.from(data).toString(),
											'ssl-target-name-override': org[prop].serverHostName,
										})
										targets.push(eh)

										continue outer
									}
								}
							}
						}
					}
				}

				if (!found) {
					logger.error(util.format('Failed to find a peer matching the url %s', peerUrl))
				}
			}

	return targets
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

var newPeers = function(urls) {
	const targets = []
	// find the peer that match the urls

	for (let peerUrl of urls) {

		for (let orgName in orgsConfig) {
			let org = orgsConfig[orgName]
			let client = getClientForOrg(orgName)

			for (let peer of org.peers) {

				if (peer.requests === peerUrl) {
					// found a peer matching the subject url
					let data = fs.readFileSync(peer.tls_cacerts)
					targets.push(client.newPeer(peerUrl, {
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': peer.serverHostName,
					}))

				}
			}
		}

	}

	if (targets.length === 0) {
		logger.error(`Failed to find any peer for urls ${urls}`)
	}

	return targets
}

var newEventHubs = function(urls, org) {
	return newRemotes(urls, false, org)
}

var getMspID = function(org) {
	const mspid = orgsConfig[org].mspid
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

var getOrgAdmin = function(userOrg) {
	const admin = orgsConfig[userOrg].admin
	const keyPath = admin.key
	var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString()
	const certPath = admin.cert
	var certPEM = readAllFiles(certPath)[0].toString()

	var client = getClientForOrg(userOrg)
	var cryptoSuite = hfc.newCryptoSuite()
	if (userOrg) {
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({ path: getKeyStorePath(userOrg) }))
		client.setCryptoSuite(cryptoSuite)
	}

	return hfc.newDefaultKeyValueStore({
		path: getKeyStorePath(userOrg),
	}).then((store) => {
		client.setStateStore(store)

		return client.createUser({
			username: 'peer' + userOrg + 'Admin',
			mspid: getMspID(userOrg),
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
	var address = testConfig[org][peer].requests
	return address.split('grpcs://')[1]
}

exports.getChannelForOrg = getChannelForOrg
exports.getClientForOrg = getClientForOrg
exports.getLogger = getLogger
exports.setGOPATH = setGOPATH
exports.getMspID = getMspID
exports.ORGS = testConfig
exports.newPeers = newPeers
exports.newEventHubs = newEventHubs
exports.getPeerAddressByName = getPeerAddressByName
exports.getRegisteredUsers = getRegisteredUsers
exports.getOrgAdmin = getOrgAdmin
