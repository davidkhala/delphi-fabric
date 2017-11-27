const install = require('./install-chaincode').install
const uninstall = require('./install-chaincode').uninstall
const instantiate = require('./instantiate-chaincode').instantiate
const helper = require('./helper')
const logger = require('./util/logger').new('testInstall')
const chaincodeConfig = require('../config/chaincode.json')
const chaincodeId = 'adminChaincode'

const chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path

const instantiate_args = [JSON.stringify(require('./vendor.json').project)]

const chaincodeVersion = 'v0'
const channelName = 'delphiChannel'
//only one time, one org could deploy
const deploy = (orgName, peerIndexes) => {
	const peers = helper.newPeers(peerIndexes, orgName)
	return uninstall(peers, { chaincodeId, chaincodeVersion }).then(() => {
		return helper.getOrgAdmin(orgName, client).then(() => {
			return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client)
		})
	})
}
const client = helper.getClient()

deploy('BU', [0, 1]).then(() => {
	return deploy('PM', [0])
	const orgName = 'PM'
	const peerIndexes = [0]
	// NOTE install but not instantiated
	return helper.getOrgAdmin(orgName, client).then(() => {
		const peers = helper.newPeers(peerIndexes, orgName)
		return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client)
	})
}).then(() => {
	return deploy('ENG', [0])
}).then(() => {
	const orgName = 'BU'
	const peers = helper.newPeers([0], orgName)
	return helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client, true)
		return instantiate(channel, peers, { chaincodeId, chaincodeVersion, args: instantiate_args })
	})

}).catch(err => logger.error(err))

//todo query installed
