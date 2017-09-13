const helper = require('./helper.js')
const logger = helper.getLogger('invoke-chaincode')
const eventHelper = require('./util/eventHub')

//TODO should we just invoke on single container? or each container in channel? or even container outside channel
const invoke = (channel, richPeers, chaincodeId, fcn, args, orgName) => {
	logger.debug({ channelName: channel.getName(), peersSize: richPeers.length, chaincodeId, fcn, args, orgName })
	const { eventWaitTime } = channel
	return helper.getOrgAdmin(orgName).then(() => {
		const client = helper.getClient()
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
					const transactionID = txId.getTransactionID()

					const promises = []

					for (let peer of richPeers) {
						const eventhub = helper.bindEventHub(peer)
						const txPromise = eventHelper.txEventPromise(eventhub, { txId,eventWaitTime }, ({ tx, code }) => {
							return code === 'VALID'
						})
						promises.push(txPromise)
					}

					return channel.sendTransaction(nextRequest).then(() => Promise.all(promises))
				})
	})

}

exports.invokeChaincode = invoke
//TODO import query.js
exports.queryChaincode = () => {

}
