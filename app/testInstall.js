const install = require('./install-chaincode').installChaincode
const instantiate = require('./instantiate-chaincode').instantiate
const helper = require('./helper')
const chaincodeConfig = require('../config/chaincode.json')
const chaincodeId = 'adminChaincode'

const chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path

const instantiate_args = []

const chaincodeVersion = 'v0'
const channelName = 'delphiChannel'
//only one time, one org could deploy
const deploy = (orgName, peerIndexes) => {
	return helper.getOrgAdmin(orgName, client).then(() => {
		const peers = helper.newPeers(peerIndexes, orgName)

		return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client).then(() => {
			const channel = helper.prepareChannel(channelName, client, true)
			return instantiate(channel, peers, { chaincodeId, chaincodeVersion, args: instantiate_args })
		})
	})
}
const client = helper.getClient()

deploy('BU', [0, 1]).then(() => {
	const orgName = 'PM'
	const peerIndexes = [0]
	// NOTE install but not instantiated
	return helper.getOrgAdmin(orgName, client).then(() => {
		const peers = helper.newPeers(peerIndexes, orgName)
		return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client)
	})
})
//todo query installed
