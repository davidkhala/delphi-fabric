const helper = require('./helper.js')
const logger = helper.getLogger('instantiate-chaincode')
const queryPeer = helper.queryPeer
const testLevel = require('./testLevel')

//TODO: projectName has problem with instantiate chaincode
//FIXME: UTC [endorser] simulateProposal -> ERRO 370 failed to invoke chaincode name:"lscc"  on transaction ec81adb6041b4b71dade56f0e9749e3dd2a2be2a63e0518ed75aa94c94f3d3fe, error: Error starting container: API error (500): {"message":"Could not attach to network delphiProject_default: context deadline exceeded"}

// "chaincodeName":"mycc",
// 		"chaincodeVersion":"v0",
// 		"args":["a","100","b","200"]
const instantiateChaincode = (channelName, peerIndex, peerConfig, chaincodeName, chaincodeVersion, args, orgName) => {
	logger.debug('============ Instantiate chaincode ============')
	logger.debug({ peerIndex, peerConfig, chaincodeName, chaincodeVersion, args, orgName })

	return helper.getOrgAdmin(orgName).then(() => {
		const channel = helper.getChannel(channelName)
		const { eventWaitTime } = channel
		//Error: Verifying MSPs not found in the channel object, make sure "intialize()" is called first.
		return channel.initialize().then(() => {

			logger.info('channel.initialize() success')
			//NOTE channel._anchor_peers = undefined here
			//NOTE channel._peers =[{"_options":{"grpc.ssl_target_name_override":"peer0.pm.delphi.com","grpc.default_authority":"peer0.pm.delphi.com","grpc.primary_user_agent":"grpc-node/1.2.4"},"_url":"grpcs://localhost:9051","_endpoint":{"addr":"localhost:9051","creds":{}},"_request_timeout":45000,"_endorserClient":{"$channel":{}},"_name":null}]
			const client = helper.getClient()
			const txId = client.newTransactionID()
			const peer = helper.newPeer(orgName, peerIndex, peerConfig)
			const request = {
				chaincodeId: chaincodeName,
				chaincodeVersion,
				args,
				fcn: 'init',// fcn is 'init' in default: `fcn` : optional - String of the function to be called on the chaincode once instantiated (default 'init')
				txId,
				targets: [peer]// optional: if not set, targets will be channel.getPeers
				// 		`chaincodeType` : optional -- Type of chaincode ['golang', 'car', 'java'] (default 'golang')
			}

			return channel.sendInstantiateProposal(request).then(([responses, proposal, header]) => {

				// TODO when targets.length>0 responses.length>0
				for (let i in responses) {
					const proposalResponse = responses[i]
					if (proposalResponse.response &&
							proposalResponse.response.status === 200) {
						logger.info(`instantiate was good for [${i}]`, proposalResponse)
					} else {
						logger.error(`instantiate was bad for [${i}], `, proposalResponse)
						return Promise.reject(responses) //NOTE logic: reject when one bad
						//	error symptons:{
						// Error: premature execution - chaincode (delphiChaincode:v1) is being launched
						// at /home/david/Documents/delphi-fabric/node_modules/grpc/src/node/src/client.js:434:17 code: 2, metadata: Metadata { _internal_repr: {} }}

					}
				}

				return Promise.resolve({
					nextRequest: {
						proposalResponses: responses, proposal
					}
				})

				// helper.sendProposalCommonPromise(channel, request, txId, 'sendInstantiateProposal')
			}).then(({ nextRequest }) => {

				const deployId = txId.getTransactionID()

				const eventHub = helper.bindEventHub(peer)
				eventHub.connect()

				const txPromise = new Promise((resolve, reject) => {
					const handle = setTimeout(() => {
						// if the transaction did not get committed within the timeout period,fail the test
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
					})
				})

				return channel.sendTransaction(nextRequest).then(() => txPromise)
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

exports.instantiateChaincode = instantiateChaincode

