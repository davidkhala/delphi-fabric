const helper = require('./helper.js')
const logger = helper.getLogger('invoke-chaincode')
const eventHelper = require('./util/eventHub')

//TODO should we just invoke on single container? or each container in channel? or even container outside channel
/**
 *
 * @param channel
 * @param richPeers
 * @param chaincodeId
 * @param fcn
 * @param args
 * @param {Client} client stateless: userContext shoudl be set in client
 * @return {Promise.<TResult>}
 */
const invoke = (channel, richPeers, chaincodeId, fcn, args, client = channel._clientContext) => {
	logger.debug({ channelName: channel.getName(), peersSize: richPeers.length, chaincodeId, fcn, args })
	const { eventWaitTime } = channel
	const txId = client.newTransactionID()

	const request = {
		chaincodeId,
		fcn,
		args,
		txId,
		targets: richPeers //optional: use channel.getPeers() as default
	}
	return channel.sendTransactionProposal(request).
			then(helper.chaincodeProposalAdapter('invoke')).
			then(({ nextRequest }) => {

				const promises = []

				for (let peer of richPeers) {
					const eventhub = helper.bindEventHub(peer)
					const txPromise = eventHelper.txEventPromise(eventhub, { txId, eventWaitTime }, ({ tx, code }) => {
						return { valid: code === 'VALID', interrupt: true }
					})
					promises.push(txPromise)
				}

				return channel.sendTransaction(nextRequest).then((/*{ status: 'SUCCESS' }*/) => {
					return Promise.all(promises).then((result) =>
							Promise.resolve(
									{
										txEventResponses: result,
										proposalResponses: nextRequest.proposalResponses
									}
							)
					)
				})
			})

}

exports.invokeChaincode = invoke
//TODO import query.js
exports.reducer = ({ proposalResponses }) =>
		proposalResponses.map((entry) => entry.response.payload.toString())
