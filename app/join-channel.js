const helper = require('./helper.js')
const logger = helper.getLogger('Join-Channel')
const eventHelper = require('./eventHubHelper')

//
//Attempt to send a request to the orderer with the sendCreateChain method
//
const joinChannel = (channel, peers, orgName) => {
	logger.debug({ channelName: channel.getName(), peersSize: peers.length, orgName })
	const eventhubs = []
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
					eventhubs.push(eventHub)
					eventHub.connect()
					const blockEventPromise = new Promise((resolve, reject) => {

						const timer_id = setTimeout(() => {
							eventHelper.unRegisterAllEvents(eventHub)
							eventHub.disconnect()
							return reject()
						}, eventWaitTime)
						eventHub.registerBlockEvent((block) => {
							clearTimeout(timer_id)
							logger.debug('new block event arrived', eventHub._ep._options, block)
							// in real-world situations, a peer may have more than one channels so
							// we must check that this block came from the channel we asked the peer to join
							if (block.data.data.length === 1) {
								// Config block must only contain one transaction
								if (block.data.data[0].payload.header.channel_header.channel_id
										=== channel.getName()) {
									eventHelper.unRegisterAllEvents(eventHub)
									return resolve()
								}
							}
							//	TODO otherwise: wait and keep eventhub connected
						}, (err) => {
							logger.error('eventhub err', err)
						})

					})

					promises.push(blockEventPromise)

				}

				return channel.joinChannel(request).then((data) => {
					logger.debug(data)
					//FIXME bug design in fabric: error message occurred in Promise.resolve/then
					return Promise.all(promises)
				}).then((data) => {

					eventhubs.forEach(eventhub => {
						eventhub.disconnect()
					})
					return data
				})
			})
}
exports.joinChannel = joinChannel
