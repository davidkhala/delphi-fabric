const install = require('./install-chaincode').install

const Upgrade = require('./instantiate-chaincode').upgrade
const helper = require('./helper')
const chaincodeConfig = require('../config/chaincode.json')
const logger = require('./util/logger').new('testUpgrade')
const chaincodeId = 'vendorChaincode'

const args = [JSON.stringify(require('./vendor.json').project)]

const channelName = 'delphiChannel'
const UpdateInstall = require('./install-chaincode').updateInstall
const updateInstallAll = (chaincodeInfo) => {
	const orgName = 'BU'
	const peerIndexes = [0]
	return helper.getOrgAdmin(orgName, client).then(() => {

		const peers = helper.newPeers(peerIndexes, orgName)
		return UpdateInstall(peers, { chaincodeId }, client)

	}).then(() => {
		const orgName = 'ENG'
		const peerIndexes = [0]
		return helper.getOrgAdmin(orgName, client).then(() => {
			const peers = helper.newPeers(peerIndexes, orgName)
			return UpdateInstall(peers, { chaincodeId }, client)
		})

	}).then(() => {

		const ChaincodeUtil = require('./util/chaincode')
		const chaincodeVersion = ChaincodeUtil.nextVersion(chaincodeInfo.version)
		const orgName = 'BU'
		return helper.getOrgAdmin(orgName, client).then(() => {
			const channel = helper.prepareChannel(channelName, client, true)
			const peers = helper.newPeers([0], orgName)
			return Upgrade(channel, peers, { chaincodeId, chaincodeVersion, args })
			//	NOTE: found all peers in channel will create chaincode container with new version for each, but the old version chaincode container remains
			//	entire KV DB will reset
		})

	})
}

const client = helper.getClient()
const Query = require('./query')

helper.getOrgAdmin('BU', client).then(() => {
	const testPeer = helper.newPeers([0], 'BU')[0]
	const channel = helper.prepareChannel(channelName, client, true)

	return Query.chaincodes.instantiated(testPeer, channel).then(({ chaincodes }) => {
		const foundChaincode = chaincodes.find((element) => {
			return element.name === chaincodeId
		})
		if (foundChaincode) {
			return Promise.resolve(foundChaincode)
		} else {
			return Promise.reject({ chaincodes })
		}
	})

}).then(updateInstallAll).catch(err => {
	logger.error(err)
	return err
})

//todo query installed
