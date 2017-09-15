const helper = require('./helper.js')
const logger = helper.getLogger('Join-Channel')
const eventHelper = require('./util/eventHub')

//
//Attempt to send a request to the orderer with the sendCreateChain method
//
const joinChannel = (channel, peers, orgName) => {
	logger.debug({ channelName: channel.getName(), peersSize: peers.length, orgName })
	const client = helper.getClient()

	return helper.getOrgAdmin(orgName).then(() => channel.getGenesisBlock({ txId: client.newTransactionID() })).
			then(genesis_block => {
				logger.debug('signature identity', client.getUserContext().getName())
				const { eventWaitTime } = channel
				const request = {
					targets: peers,
					txId: client.newTransactionID(),
					block: genesis_block
				}

				const promises = []
				for (let peer of peers) {
					const eventHub = helper.bindEventHub(peer)

					const validator = ({ block }) => {
						logger.debug('new block event arrived', eventHub._ep, block)
						// in real-world situations, a peer may have more than one channels so
						// we must check that this block came from the channel we asked the peer to join
						if (block.data.data.length === 1) {
							// Config block must only contain one transaction
							if (block.data.data[0].payload.header.channel_header.channel_id
									=== channel.getName()) {
								return { valid: true, interrupt: true }
							}
						}
						return { valid: false, interrupt: false }
					}
					const blockEventPromise = eventHelper.blockEventPromise(eventHub, { eventWaitTime }, validator)

					promises.push(blockEventPromise)

				}

				return channel.joinChannel(request).then((data) => {
					logger.debug({ data })
					//FIXME bug design in fabric: error message occurred in Promise.resolve/then
					const joinedBefore = []
					const joinedBeforeSymptom = '(status: 500, message: Cannot create ledger from genesis block, due to LedgerID already exists)'
					for (let dataEntry of data) {
						if (dataEntry instanceof Error) {
							//swallow 'joined before' error: Error: chaincode error (status: 500, message: Cannot create ledger from genesis block, due to LedgerID already exists)
							if (dataEntry.toString().includes(joinedBeforeSymptom)) {
								logger.warn('swallow when existence')
								joinedBefore.push(dataEntry)
							} else {
								return Promise.reject(data)
							}
						}
					}
					if (joinedBefore.length === data.length) {
						return Promise.resolve(data)
					} else {
						return Promise.all(promises)
					}
				})
			})
}
exports.joinChannel = joinChannel
