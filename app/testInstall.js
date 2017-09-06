const installchaincode = require('./install-chaincode').installChaincode
const instantiateChaincode = require('./instantiate-chaincode').instantiateChaincode
const chaincodeName = 'delphiChaincode'

const CHAINCODE_PATH = 'github.com/delphi'

const peerIndexes = [0, 1]

const chaincode_args = []
const chaincodeVersion = 'v0'
const orgName = 'BU'
const channelName = 'delphiChannel'
installchaincode(peerIndexes, chaincodeName, CHAINCODE_PATH, chaincodeVersion, orgName).then(() => {

	const peerIndex = 0
	return instantiateChaincode(channelName, peerIndex,
			{ 'portMap': [{ 'host': 7051, 'container': 7051 }, { 'host': 7053, 'container': 7053 }] },
			chaincodeName, chaincodeVersion, chaincode_args, orgName)
})
//todo query installed
