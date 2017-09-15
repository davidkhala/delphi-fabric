const install = require('./install-chaincode').installChaincode
const instantiate = require('./instantiate-chaincode').instantiateChaincode
const helper = require('./helper')
const chaincodeConfig=require('../config/chaincode.json')
const chaincodeId = 'delphiChaincode'

const chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path

const peerIndexes = [0, 1]

const instantiate_args = []

const chaincodeVersion = 'v0'
const orgName = 'BU'
const channelName = 'delphiChannel'
const peers = helper.newPeers(peerIndexes, orgName)
install(peers, chaincodeId, chaincodePath, chaincodeVersion, orgName).then(() => {

	const peers = helper.newPeers(peerIndexes, orgName)
	const channel = helper.getChannel(channelName)
	return instantiate(channel, peers, chaincodeId, chaincodeVersion, instantiate_args, orgName)

})

//todo query installed
