const install = require('./install-chaincode').installChaincode
const instantiate = require('./instantiate-chaincode').instantiateChaincode
const helper = require('./helper')
const chaincodeName = 'delphiChaincode'

const CHAINCODE_PATH = 'github.com/delphi'

const peerIndexes = [0, 1]

const instantiate_args = []

const chaincodeVersion = 'v0'
const orgName = 'BU'
const channelName = 'delphiChannel'
const peers = helper.newPeers(peerIndexes, orgName)
install(peers, chaincodeName, CHAINCODE_PATH, chaincodeVersion, orgName).then(() => {

	const peers = helper.newPeers(peerIndexes, orgName)
	const channel = helper.getChannel(channelName)
	return instantiate(channel, peers, chaincodeName, chaincodeVersion, instantiate_args, orgName)

})

//todo query installed
