/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
const util = require('util')
const fs = require('fs')
const helper = require('./helper.js')
const logger = helper.getLogger('Create-Channel')
//Attempt to send a request to the orderer with the sendCreateChain method
//"../artifacts/channel/mychannel.tx"
const createChannel = function(channelName, channelConfigFile, username, orgName) {
	logger.debug('\n====== Creating Channel \'' + channelName + '\' ======\n')
	logger.debug(`params: ${{ channelName, channelConfigPath: channelConfigFile, username, orgName }}`)

	const client = helper.getClient()
	const channel = helper.getChannel(channelName)

	// read in the envelope for the channel config raw bytes
	const channelConfig_envelop = fs.readFileSync(channelConfigFile)
	// extract the channel config bytes from the envelope to be signed
	const channelConfig = client.extractChannelConfig(channelConfig_envelop)

	logger.debug('client extractChannelConfig from \'mychannel.tx', { channelConfig })

	//Acting as a client in the given organization provided with "orgName" param
	return helper.getOrgAdmin(orgName).then((admin) => {
		logger.debug(util.format('Successfully acquired admin user for the organization "%s"', orgName))
		// sign the channel config bytes as "endorsement", this is required by
		// the orderer's channel creation policy
		let signature = client.signChannelConfig(channelConfig)

		let request = {
			config: channelConfig,
			signatures: [signature],
			name: channelName,
			orderer: channel.getOrderers()[0],
			txId: client.newTransactionID()
		}

		// send to orderer
		return client.createChannel(request)
	}).then((response) => {
		if (response && response.status === 'SUCCESS') {
			logger.debug(`Successfully created the channel.${{ response }}`)
			return response
		} else {
			throw new Error(`Failed to create the channel`)
		}
	})
}

exports.createChannel = createChannel
//TODO in development
exports.updateChannel = (channelName, channelConfigFile, username, orgName) => {

	logger.debug('\n====== update Channel \'' + channelName + '\' ======\n')
	logger.debug(`params: ${{ channelName, channelConfigPath: channelConfigFile, username, orgName }}`)

	const client = helper.getClient()
	const channel = helper.getChannel(channelName)

	// read in the envelope for the channel config raw bytes
	const channelConfig_envelop = fs.readFileSync(channelConfigFile)
	// extract the channel config bytes from the envelope to be signed
	const channelConfig = channel.loadConfigUpdateEnvelope(channelConfig_envelop)

	//Acting as a client in the given organization provided with "orgName" param
	return helper.getOrgAdmin(orgName).then((admin) => {
		// sign the channel config bytes as "endorsement", this is required by
		// the orderer's channel creation policy
		let signature = client.signChannelConfig(channelConfig)

		let request = {
			config: channelConfig,
			signatures: [signature],
			name: channelName,
			orderer: channel.getOrderers()[0],
			txId: client.newTransactionID(),
			envelope: undefined
		}
		// send to orderer
		return client.updateChannel(request)
	})
}