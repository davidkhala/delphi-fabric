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
const helper = require('./helper.js')
const logger = helper.getLogger('invoke-chaincode')

//TODO should we just invoke on single container? or each container in channel? or even container outside channel
const invoke = function(channelName, containerNames, chaincodeName, fcn, args, username, org) {
	logger.debug(`\n============ invoke transaction ============\n`)
	logger.debug('params:', { channelName, containerNames, chaincodeName, fcn, args, username, org })
	const client = helper.getClientForOrg(org)
	const channel = helper.getChannel(org, channelName)

	return helper.getOrgAdmin(org).then((user) => {
		const txId = client.newTransactionID()

		//Note if request has no targets, channel will use its binding peers, See in Channel.js
		// -- logger.debug('sendTransactionProposal - request does not have targets using this channels endorsing peers');
		// -- request.targets = this.getPeers();
		const request = {
			chaincodeId: chaincodeName,
			fcn,
			args,
			txId
		}
		return new Promise((resolve, reject) => {
			channel.sendTransactionProposal(request).then(([responses, proposal, header]) => {
				//data transform
				resolve({ txId, responses, proposal })
			}).catch(err => {reject(err)})
		})
	}).then(({ txId, responses, proposal }) => {
		//TODO do this in previsou promise
		for (let i in responses) {
			const proposalResponse = responses[i]
			if (proposalResponse.response &&
					proposalResponse.response.status === 200) {
				logger.info(`transaction proposal was good for [${i}]`, proposalResponse)
			} else {
				logger.error(`transaction proposal was bad for [${i}]`, proposalResponse)
				return
			}
		}
		logger.debug(`Successfully sent Proposal and received ProposalResponse:`)
		const request = { proposalResponses: responses, proposal }
		// set the transaction listener and set a timeout of 30sec
		// if the transaction did not get committed within the timeout period,
		// fail the test
		const transactionID = txId.getTransactionID()
		var eventPromises = []

		var eventhubs = helper.newEventHubs(containerNames, org)
		for (let key in eventhubs) {
			let eh = eventhubs[key]
			eh.connect()

			let txPromise = new Promise((resolve, reject) => {
				let handle = setTimeout(() => {
					eh.disconnect()
					reject()
				}, 30000)

				eh.registerTxEvent(transactionID, (tx, code) => {
					clearTimeout(handle)
					eh.unregisterTxEvent(transactionID)
					eh.disconnect()

					if (code !== 'VALID') {
						logger.error(
								'The transaction was invalid, code = ' + code)
						reject()
					} else {
						logger.info(
								'The transaction has been committed on peer ' +
								eh._ep._endpoint.addr)
						resolve()
					}
				})
			})
			eventPromises.push(txPromise)
		}

		var sendPromise = channel.sendTransaction(request)
		return Promise.all([sendPromise].concat(eventPromises)).then((results) => {
					logger.debug(' event promise all complete and testing complete')
					return results[0] // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
				}
		)
	}).catch(err => {
		logger.error(err)
	})
}

exports.invokeChaincode = invoke
//TODO import query.js
exports.queryChaincode= ()=>{

}
