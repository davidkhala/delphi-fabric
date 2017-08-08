'use strict'
const fs = require('fs')
const helper = require('./helper.js')
const logger = helper.getLogger('instantiate-chaincode')
const ORGS = helper.ORGS
const GPRC_protocol = ORGS.GPRC_protocol
const _ = require('lodash')
const queryOrgName = helper.queryPeer
const gen_tls_cacerts = helper.gen_tls_cacerts
const COMPANY = ORGS.COMPANY

//TODO do not be global
// "chaincodeName":"mycc",
// 		"chaincodeVersion":"v0",
// 		"args":["a","100","b","200"]
const instantiateChaincode = function(
		channelName, containerName, chaincodeName, chaincodeVersion, args, username, org) {
	logger.debug('\n============ Instantiate chaincode ============\n')
	logger.debug({ containerName, chaincodeName, chaincodeVersion, args, username, org })
	const channel = helper.getChannel(org, channelName)
	const client = helper.getClientForOrg(org)

	return helper.getOrgAdmin(org).then((user) => {
		// read the config block from the orderer for the channel
		// and initialize the verify MSPs based on the participating
		// organizations

		//TODO channel.initialize is time-consuming operation
		return channel.initialize()
	}).then((config_items) => {
		logger.info(`channel.initialize success:`, config_items)
		//NOTE channel._anchor_peers = undefined here
		//NOTE channel._peers =[{"_options":{"grpc.ssl_target_name_override":"peer0.pm.delphi.com","grpc.default_authority":"peer0.pm.delphi.com","grpc.primary_user_agent":"grpc-node/1.2.4"},"_url":"grpcs://localhost:9051","_endpoint":{"addr":"localhost:9051","creds":{}},"_request_timeout":45000,"_endorserClient":{"$channel":{}},"_name":null}]
		// logger.debug(`[debug] channel.clientContext.`, channel._clientContext)
		// logger.debug(`[debug] channel._peers${JSON.stringify(channel._peers)}`)
		const txId = client.newTransactionID()
		// send proposal to endorser

		const request = {
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

		return helper.sendProposalCommonPromise(channel,request,txId,"sendInstantiateProposal")
		
	}).then(({ txId, nextRequest}) => {
				// results exist even proposal error, need to check each entry

				logger.info(`Successfully sent Proposal and received ProposalResponse`)
				// set the transaction listener and set a timeout of 30sec
				// if the transaction did not get committed within the timeout period,
				// fail the test
				const deployId = txId.getTransactionID()

				const { key: orgName, peer: { index: peerIndex, value: peerConfig } } = queryOrgName(containerName)

				const eh = helper.newEventHub(orgName, peerIndex, peerConfig.portMap, client)
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

				const sendPromise = channel.sendTransaction(nextRequest)
				return Promise.all([sendPromise].concat([txPromise])).then((results) => {
					logger.debug('Event promise all complete and testing complete')
					return results[0] // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
				})

			}
	).catch(error => {
		logger.error(error)
	})
}

// to remove container like: dev-peer0.pm.delphi.com-delphichaincode-v1
// to remove images like: dev-peer0.pm.delphi.com-delphichaincode-v1:latest
// @param {string} containerName which initial the instantiate action before
exports.resetChaincode = function(containerName, chaincodeName, chaincodeVersion) {
	const dockerodeUtil = require('./../common/docker/nodejs/dockerode-util')
	const { key: orgName, peer: { value: peerConfig, peer_hostName_full } } = queryOrgName(
			containerName)
	const ccContainerName = `dev-${peer_hostName_full}-${chaincodeName.toLowerCase()}-${chaincodeVersion}`
	return dockerodeUtil.deleteContainer(ccContainerName).then(() => {
		//dev-peer0.pm.delphi.com-delphichaincode-v1:latest
		return dockerodeUtil.deleteImage(ccContainerName)
	})

	//TODO besides, core/scc/lscc/lscc.go will also using  stub.GetState(ccname) to check chaincode existence
}

exports.instantiateChaincode = instantiateChaincode

