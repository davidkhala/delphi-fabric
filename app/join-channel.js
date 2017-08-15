const helper = require('./helper.js')
const logger = helper.getLogger('Join-Channel')

const helperConfig = helper.helperConfig
const COMPANY = helperConfig.COMPANY
const companyConfig = helperConfig[COMPANY]

//
//Attempt to send a request to the orderer with the sendCreateChain method
//
const joinChannel = (channelName, containerNames) => {

	logger.debug(`params: ${{ channelName, containerNames }}`)

	const client = helper.getClient()
	const channel = helper.getChannel(channelName)
	logger.debug(channel.getPeers())
	const { eventWaitTime } = channel

	return channel.getGenesisBlock({ txId: client.newTransactionID() }).
			then(genesis_block => {
				const request = {
					targets: helper.newPeers(containerNames),
					txId: client.newTransactionID(),
					block: genesis_block
				}

				const eventhubs = helper.newEventHubs(containerNames)

				const promises = [channel.joinChannel(request)]
				eventhubs.forEach(eh => {
					eh.connect()
					let txPromise = new Promise((resolve, reject) => {
						let handle = setTimeout(() => {
							eh.disconnect()
							reject()
						}, eventWaitTime)
						eh.registerBlockEvent((block) => {
							clearTimeout(handle)
							logger.debug('blockEvent', block)

							// in real-world situations, a peer may have more than one channels so
							// we must check that this block came from the channel we asked the peer to join
							if (block.data.data.length === 1) {
								// Config block must only contain one transaction
								if (block.data.data[0].payload.header.channel_header.channel_id
										=== channelName) {
									eh.disconnect()
									resolve()
								}
								else {
									reject()
								}
							}
						})
					})
					promises.push(txPromise)
				})
				return Promise.all(promises)
			})
}
exports.joinChannel = joinChannel
