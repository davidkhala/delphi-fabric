const install = require('./install-chaincode').installChaincode
const instantiate = require('./instantiate-chaincode').instantiateChaincode
const helper = require('./helper')
const chaincodeConfig = require('../config/chaincode.json')
const chaincodeId = 'adminChaincode'

const chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path

const instantiate_args = []

const chaincodeVersion = 'v0'
const channelName = 'delphiChannel'
//only one time, one org could deploy
const deploy = (orgName, peerIndexes) => {
	return helper.getOrgAdmin(orgName).then(() => {
		const peers = helper.newPeers(peerIndexes, orgName)
		const client = helper.getClient()
		return install(peers, chaincodeId, chaincodePath, chaincodeVersion, client).then(() => {
			const channel = helper.getChannel(channelName)
			return instantiate(channel, peers, chaincodeId, chaincodeVersion, instantiate_args, client)
		})
	})
}

deploy('BU', [0, 1]).then(()=>{
	const orgName="PM"
	const peerIndexes=[0]
	// NOTE install but not instantiated
	return helper.getOrgAdmin(orgName).then(() => {
		const peers = helper.newPeers(peerIndexes, orgName)
		const client = helper.getClient()
		return install(peers, chaincodeId, chaincodePath, chaincodeVersion, client)
	})
})
//todo query installed
