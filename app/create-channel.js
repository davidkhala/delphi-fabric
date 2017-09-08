const fs = require('fs')
const helper = require('./helper.js')
const logger = helper.getLogger('create-Channel')
const multiSign = require('./multiSign').signs
//Attempt to send a request to the orderer with the sendCreateChain method
//"../artifacts/channel/mychannel.tx"
const createChannel = (channelName, channelConfigFile, orgNames) => {
	logger.debug('====== Creating Channel ======')
	logger.debug({ channelName, channelConfigFile, orgNames })

	const client = helper.getClient()
	const clientSwitchPromises = []
	for (let orgName of orgNames) {
		const switchPromise = () => {
			return helper.getOrgAdmin(orgName)
		}
		clientSwitchPromises.push(switchPromise)
	}
	const channelConfig_envelop = fs.readFileSync(channelConfigFile)

	// extract the channel config bytes from the envelope to be signed
	const channelConfig = client.extractChannelConfig(channelConfig_envelop)
	logger.debug({ channelConfig })
	return multiSign(client, clientSwitchPromises, channelConfig).then(signatures => {
		const channel = helper.getChannel(channelName)
		const txId = client.newTransactionID()
		const request = {
			config: channelConfig,
			signatures,
			name: channelName.toLowerCase(),
			orderer: channel.getOrderers()[0],
			txId
		}
		logger.debug('signatures', signatures.length)
		const loopGetChannel = () => {
			return channel.initialize().catch(err => {
				if (err.toString().includes('Invalid results returned ::NOT_FOUND')) {
					logger.warn('loopGetChannel', 'try...')
					return loopGetChannel()
				}
				return err
			})
		}
		//NOTE before channel created, channel.getGenesisBlock() return:Error: Invalid results returned ::NOT_FOUND
		return client.createChannel(request).then((results) => {
			logger.debug('channel created', results)
			return loopGetChannel().then((channelConfig) => {
				logger.info('channel initialized')
				//NOTE channel.getGenesisBlock({txId:client.newTransactionID()}) ready here
				return channelConfig
			})

		})

	})
}

exports.createChannel = createChannel