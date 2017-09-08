const helper = require('./helper.js')
const logger = helper.getLogger('instantiate-chaincode')
const queryPeer = helper.queryPeer
const testLevel = require('./testLevel')

//FIXED: UTC [endorser] simulateProposal -> ERRO 370 failed to invoke chaincode name:"lscc"  on transaction ec81adb6041b4b71dade56f0e9749e3dd2a2be2a63e0518ed75aa94c94f3d3fe, error: Error starting container: API error (500): {"message":"Could not attach to network delphiProject_default: context deadline exceeded"}: setting docker network instead of docker-compose --project-name

// "chaincodeName":"mycc",
// 		"chaincodeVersion":"v0",
// 		"args":["a","100","b","200"]
// set peers to 'undefined' to target all peers in channel
exports.instantiateChaincode = (channelName, richPeers, chaincodeId, chaincodeVersion, args, orgName) => {
	logger.debug('============ Instantiate chaincode ============')
	logger.debug({ channelName, peersSize: richPeers.length, chaincodeId, chaincodeVersion, args, orgName })

	return helper.getOrgAdmin(orgName).then(() => {
		const channel = helper.getChannel(channelName)
		const { eventWaitTime } = channel
		//Error: Verifying MSPs not found in the channel object, make sure "intialize()" is called first.
		return channel.initialize().then(() => {

			logger.info('channel.initialize() success',channel.getOrganizations())
			const client = helper.getClient()
			const txId = client.newTransactionID()
			const request = {
				chaincodeId,
				chaincodeVersion,
				args,
				fcn: 'init',// fcn is 'init' in default: `fcn` : optional - String of the function to be called on the chaincode once instantiated (default 'init')
				txId,
				targets: richPeers// optional: if not set, targets will be channel.getPeers
				// 		`chaincodeType` : optional -- Type of chaincode ['golang', 'car', 'java'] (default 'golang')
			}

			return channel.sendInstantiateProposal(request).then(([responses, proposal, header]) => {

				const errCounter = [] // NOTE logic: reject only when all bad
				for (let i in responses) {
					const proposalResponse = responses[i]
					if (proposalResponse.response &&
							proposalResponse.response.status === 200) {
						logger.info(`instantiate was good for [${i}]`, proposalResponse)
					} else {
						logger.error(`instantiate was bad for [${i}]`, proposalResponse)
						errCounter.push(proposalResponse)
					}
				}
				if (errCounter.length === responses.length) {
					return Promise.reject(responses)
				}

				return Promise.resolve({
					nextRequest: {
						proposalResponses: responses, proposal
					}
				})

			}).then(({ nextRequest }) => {

				const deployId = txId.getTransactionID()

				const promises = []
				for (let peer of richPeers) {
					const eventHub = helper.bindEventHub(peer)
					eventHub.connect()
					const txPromise = new Promise((resolve, reject) => {
						const handle = setTimeout(() => {
							// if the transaction did not get committed within the timeout period,fail the test
							eventHub.unregisterTxEvent(deployId)
							eventHub.disconnect()
							reject()
						}, eventWaitTime)

						eventHub.registerTxEvent(deployId, (tx, code) => {
							logger.info('txevent ', eventHub._ep)
							clearTimeout(handle)
							eventHub.unregisterTxEvent(deployId)
							eventHub.disconnect()

							if (code !== 'VALID') {
								reject({ tx, code })
							} else {
								resolve({ tx, code })
							}
						}, err => {
							logger.error('txevent', err)
						})
					})
					promises.push(txPromise)
				}

				return channel.sendTransaction(nextRequest).then(() => {
					logger.info('channel.sendTransaction success')
					return Promise.all(promises)
				})
			})
		})
	})
}

// to remove container like: dev-peer0.pm.delphi.com-delphichaincode-v1
// to remove images like: dev-peer0.pm.delphi.com-delphichaincode-v1:latest
// @param {string} containerName which initial the instantiate action before
exports.resetChaincode = function(containerName, chaincodeName, chaincodeVersion) {
	const dockerodeUtil = require('./../common/docker/nodejs/dockerode-util')
	const { key: orgName, peer: { value: peerConfig, peer_hostName_full } } = queryPeer(
			containerName)
	const ccContainerName = `dev-${peer_hostName_full}-${chaincodeName.toLowerCase()}-${chaincodeVersion}`
	return dockerodeUtil.deleteContainer(ccContainerName).then(() => {
		//dev-peer0.pm.delphi.com-delphichaincode-v1:latest
		return dockerodeUtil.deleteImage(ccContainerName)
	}).then(() => {
		logger.debug('====ready to operate leveldb')
		//TODO delete in all containers first
		return testLevel.deleteChaincode(chaincodeName)
	})

	//TODO besides, core/scc/lscc/lscc.go will also using  stub.GetState(ccname) to check chaincode existence
}


