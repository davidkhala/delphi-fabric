const fs = require('fs')
const helper = require('./helper.js')
const logger = helper.getLogger('create-Channel')
//Attempt to send a request to the orderer with the sendCreateChain method
//"../artifacts/channel/mychannel.tx"
const createChannel = (channelName, channelConfigFile, orgName) => {
	logger.debug('\n====== Creating Channel \'' + channelName + '\' ======\n')
	logger.debug({ channelName, channelConfigFile, orgName })

	//Acting as a client in the given organization provided with "orgName" param
	return helper.getOrgAdmin(orgName).then(() => {

				const client = helper.getClient()

				const channel = helper.getChannel(channelName)
				// read in the envelope for the channel config raw bytes
				const channelConfig_envelop = fs.readFileSync(channelConfigFile)

				// extract the channel config bytes from the envelope to be signed
				const channelConfig = client.extractChannelConfig(channelConfig_envelop)

				// sign the channel config bytes as "endorsement", this is required by the orderer's channel creation policy
				const signature = client.signChannelConfig(channelConfig)

				const request = {
					config: channelConfig,
					signatures: [signature],
					name: channelName.toLowerCase(),
					orderer: channel.getOrderers()[0],
					txId: client.newTransactionID()
				}

				// send to orderer
				const channelCreatePromise = client.createChannel(request)

				//eventhub mechanism not working: hanging, since no block event caught

				//TODO pull request here, also sleep 5 seconds in test/integration/create-configtx-channel.js
				const loopGetChannel = () => {
					return channel.initialize().catch(err => {
						if (err.toString().includes('Invalid results returned ::NOT_FOUND')) {
							logger.warn('loopGetChannel', 'try...')
							return loopGetChannel()
						}
						return err
					})
				}
				return channelCreatePromise.then((results) => {
					logger.debug('channel created', results)
					return loopGetChannel().then((channelConfig) => {
						logger.info('channel initialized')
						return channelConfig
					})

				})
			}
	)
}

exports.createChannel = createChannel