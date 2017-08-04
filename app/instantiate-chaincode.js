/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict'
var fs = require('fs')
var helper = require('./helper.js')
var logger = helper.getLogger('instantiate-chaincode')
const ORGS = helper.ORGS
const queryOrgName = helper.queryOrgName
const gen_tls_cacerts = helper.gen_tls_cacerts
const COMPANY = ORGS.COMPANY
const companyConfig = ORGS[COMPANY]
// "chaincodeName":"mycc",
// 		"chaincodeVersion":"v0",
// 		"args":["a","100","b","200"]

const instantiateChaincode = function(containerName, chaincodeName, chaincodeVersion, args, username, org) {
	logger.debug('\n============ Instantiate chaincode ============\n')
	logger.debug({ containerName, chaincodeName, chaincodeVersion, args, username, org })
	var channel = helper.getChannelForOrg(org)
	var client = helper.getClientForOrg(org)

	return helper.getOrgAdmin(org).then((user) => {
		// read the config block from the orderer for the channel
		// and initialize the verify MSPs based on the participating
		// organizations
		return channel.initialize()
	}, (err) => {
		logger.error('Failed to enroll user \'' + username + '\'. ' + err)
		throw new Error('Failed to enroll user \'' + username + '\'. ' + err)
	}).then((success) => {
		const txId = client.newTransactionID()
		// send proposal to endorser

		var request = {
			chaincodeId: chaincodeName,
			chaincodeVersion,
			args: args,
			fcn: 'init',// fcn is 'init' in default
			txId
			// NOTE jsdoc: param: request
			// An object containing the following fields:
			// `chaincodePath` : required - String of the path to location of the source code of the chaincode
			// 		`chaincodeId` : required - String of the name of the chaincode
			// 		`chaincodeVersion` : required - String of the version of the chaincode
			// 		`txId` : required - String of the transaction id
			// 		`targets` : Optional : An array of endorsing Peer objects as the targets of the request. The list of endorsing peers will be used if this parameter is omitted.
			// 		`chaincodeType` : optional -- Type of chaincode ['golang', 'car', 'java'] (default 'golang')
			// 		`transientMap` : optional - map that can be used by the chaincode but not saved in the ledger, such as cryptographic information for encryption
			// 		`fcn` : optional - String of the function to be called on the chaincode once instantiated (default 'init')
			// `args` : optional - String Array arguments specific to the chaincode being instantiated
			// 		`endorsement-policy` : optional - EndorsementPolicy object for this chaincode. If not specified, a default policy of "a signature by any member from any of the organizations corresponding to the array of member service providers" is used
		}

		return channel.sendInstantiateProposal(request)
	}, (err) => {
		logger.error(`Failed to initialize the channel ${err}`)
		throw new Error(`Failed to initialize the channel ${err}`)
	}).then((results) => {
				const proposalResponses = results[0]
				const proposal = results[1]
				let all_good = true

				for (let proposalResponse of proposalResponses) {
					if (proposalResponse.response &&
							proposalResponse.response.status === 200) {
						logger.info('instantiate proposal was good')
					} else {
						all_good = false
						logger.error('instantiate proposal was bad')
					}
				}
				if (all_good) {
					logger.info(
							`Successfully sent Proposal and received ProposalResponse:Status - ${proposalResponses[0].response.status},message - "${proposalResponses[0].response.message}",metadata - "${proposalResponses[0].response.payload}",endorsement signature: ${proposalResponses[0].endorsement.signature}`)
					const request = { proposalResponses, proposal }
					logger.debug(request)
					// set the transaction listener and set a timeout of 30sec
					// if the transaction did not get committed within the timeout period,
					// fail the test
					const deployId = txId.getTransactionID()

					//FIXME: to use newEventHub in helper.js
					const eh = client.newEventHub()

					const { key: orgName, peer: { index: peerIndex, value: peerConfig } } = queryOrgName(containerName)

					const { peer_hostName_full, tls_cacerts } = gen_tls_cacerts(orgName, peerIndex)
					const data = fs.readFileSync(tls_cacerts)
					let events
					for (let portMapEach of peerConfig.portMap) {
						if (portMapEach.container === 7053) {
							events = `${GPRC_PROTOCAL}localhost:${portMapEach.host}`
						}
					}
					if (!events) {
						logger.warn(`Could not find port mapped to 7053 for peer host==${peer_hostName_full}`)
						return {}//TODO ok??here?
					}

					eh.setPeerAddr(events, {
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': peer_hostName_full
					})
					eh.connect()

					let txPromise = new Promise((resolve, reject) => {
						let handle = setTimeout(() => {
							eh.disconnect()
							reject()
						}, 30000)

						eh.registerTxEvent(deployId, (tx, code) => {
							logger.info(
									'The chaincode instantiate transaction has been committed on peer ' +
									eh._ep._endpoint.addr)
							clearTimeout(handle)
							eh.unregisterTxEvent(deployId)
							eh.disconnect()

							if (code !== 'VALID') {
								logger.error('The chaincode instantiate transaction was invalid, code = ' + code)
								reject()
							} else {
								logger.info('The chaincode instantiate transaction was valid.')
								resolve()
							}
						})
					})

					var sendPromise = channel.sendTransaction(request)
					return Promise.all([sendPromise].concat([txPromise])).then((results) => {
						logger.debug('Event promise all complete and testing complete')
						return results[0] // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
					}).catch((err) => {
						logger.error(
								`Failed to send instantiate transaction and get notifications within the timeout period. ${err}`
						)
						return 'Failed to send instantiate transaction and get notifications within the timeout period.'
					})
				}
				else {
					logger.error(
							'Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...'
					)
					return 'Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...'
				}
			},
			(err) => {
				logger.error('Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err)
				return 'Failed to send instantiate proposal due to error: ' + err.stack ? err.stack : err
			}
	).
			then((response) => {
				if (response.status === 'SUCCESS') {
					logger.info('Successfully sent transaction to the orderer.')
					return 'Chaincode Instantiateion is SUCCESS'
				} else {
					logger.error('Failed to order the transaction. Error code: ' + response.status)
					return 'Failed to order the transaction. Error code: ' + response.status
				}
			}, (err) => {
				logger.error('Failed to send instantiate due to error: ' + err.stack ? err.stack : err)
				return 'Failed to send instantiate due to error: ' + err.stack ? err.stack : err
			})
}

exports.instantiateChaincode = instantiateChaincode
