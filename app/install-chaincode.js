//NOTE install chaincode does not require channel existence
const helper = require('./helper.js')
const logger = require('./util/logger').new('install-chaincode')

//allowedCharsChaincodeName = "[A-Za-z0-9_-]+"
// allowedCharsVersion       = "[A-Za-z0-9_.-]+"
//
const installChaincode = (peers, chaincodeId, chaincodePath, chaincodeVersion, client) => {
	logger.debug('============ Install chaincode ============')
	logger.debug({ peers_length: peers.length, chaincodeId, chaincodePath, chaincodeVersion})
	helper.setGOPATH()

	const request = {
		targets: peers,
		chaincodePath,
		chaincodeId,
		chaincodeVersion
	}
	return client.installChaincode(request).then(helper.chaincodeProposalAdapter('install', (proposalResponse) => {
		if (proposalResponse.response && proposalResponse.response.status === 200) return true
		if (proposalResponse instanceof Error && proposalResponse.toString().includes('exists')) {
			logger.warn('swallow when exsitence')
			return true
		}
		return false
	}))
}
exports.installChaincode = installChaincode
