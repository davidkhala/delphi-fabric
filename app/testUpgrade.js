const install = require('./install-chaincode').installChaincode

const Upgrade = require('./instantiate-chaincode').upgrade
const helper = require('./helper')
const chaincodeConfig = require('../config/chaincode.json')
const logger = require('./util/logger').new('./testUpgrade')
const chaincodeId = 'adminChaincode'
const chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path

const args = []

const chaincodeVersion = 'v2'
const channelName = 'delphiChannel'
//only one time, one org could deploy
const installAll = () => {
	const orgName = 'BU'
	const peerIndexes = [0, 1]
	return helper.getOrgAdmin(orgName, client).then(() => {
		const peers = helper.newPeers(peerIndexes, orgName)
		return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client)

	}).then(() => {
		const orgName = 'PM'
		const peerIndexes = [0]
		return helper.getOrgAdmin(orgName, client).then(() => {
			const peers = helper.newPeers(peerIndexes, orgName)
			return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client)
		})

	}).then(() => {

		const orgName = 'PM'
		const peerIndexes = [0]

		return helper.getOrgAdmin(orgName, client).then(() => {
			const channel = helper.prepareChannel(channelName, client, true)
			const peers = helper.newPeers(peerIndexes, orgName)
			return Upgrade(channel, peers, { chaincodeId, chaincodeVersion, args })
		//	NOTE: found all peers in channel will create chaincode container with new version for each, but the old version chaincode container remains
		//	entire KV DB will reset
		})
	})
}

const client = helper.getClient()

installAll('BU', [0, 1]).catch(err => {
	logger.error(err)
	return err
})

//todo query installed
