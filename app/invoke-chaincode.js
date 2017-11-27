const helper = require('./helper.js')
const logger = require('./util/logger').new('invoke-chaincode')
const eventHelper = require('./util/eventHub')

/**
 *
 * @param channel
 * @param richPeers
 * @param chaincodeId
 * @param fcn
 * @param args
 * @param client
 * @return {Promise.<TResult>}
 */
const invoke = (channel, richPeers, { chaincodeId, fcn, args }, client = channel._clientContext) => {
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
			then(({ nextRequest, errCounter }) => {
				const { proposalResponses } = nextRequest

				if (errCounter === proposalResponses.length) {
					return Promise.reject({ proposalResponses })
				}
				const promises = []

				for (let peer of richPeers) {
					const eventhub = helper.bindEventHub(peer, client)
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
										proposalResponses
									}
							)
					)
				})
			})

}

exports.invokeChaincode = invoke

exports.reducer = ({ proposalResponses }) =>
		proposalResponses.map((entry) => entry.response.payload.toString())
//TODO import query.js
