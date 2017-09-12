const installchaincode = require('./install-chaincode').installChaincode
const instantiateChaincode = require('./instantiate-chaincode').instantiateChaincode
const helper=require('./helper')
const chaincodeName = 'delphiChaincode'

const CHAINCODE_PATH = 'github.com/delphi'

const peerIndexes = [0, 1]

const chaincode_args = []
const chaincodeVersion = 'v0'
const orgName = 'BU'
const channelName = 'delphiChannel'
const peers=helper.newPeers(peerIndexes,orgName)
installchaincode(peers, chaincodeName, CHAINCODE_PATH, chaincodeVersion, orgName).then(() => {

	const peers=helper.newPeers(peerIndexes,orgName)
	const channel=helper.getChannel(channelName)
	return instantiateChaincode(channel,peers,
			chaincodeName, chaincodeVersion, chaincode_args, orgName)
})
//todo query installed
