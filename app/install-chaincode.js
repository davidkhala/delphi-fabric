//NOTE install chaincode does not require channel existence
const helper = require('./helper.js')
const logger = require('./util/logger').new('install-chaincode')

//allowedCharsChaincodeName = "[A-Za-z0-9_-]+"
// allowedCharsVersion       = "[A-Za-z0-9_.-]+"
//
const installChaincode = (peers, { chaincodeId, chaincodePath, chaincodeVersion }, client) => {
	logger.debug('============ Install chaincode ============')
	logger.debug({ peers_length: peers.length, chaincodeId, chaincodePath, chaincodeVersion })
	helper.setGOPATH()

	const request = {
		targets: peers,
		chaincodePath,
		chaincodeId,
		chaincodeVersion
	}
	return client.installChaincode(request).then(helper.chaincodeProposalAdapter('install', (proposalResponse) => {
		const { response } = proposalResponse
		if (response && response.status === 200) return {
			isValid: true,
			isSwallowed: false
		}
		if (proposalResponse instanceof Error && proposalResponse.toString().includes('exists')) {
			logger.warn('swallow when exsitence')
			return { isValid: true, isSwallowed: true }
		}
		return { isValid: false, isSwallowed: false }
	})).then((result) => {
		const { errCounter, nextRequest: { proposalResponses } } = result
		if (errCounter === proposalResponses.length) {
			return Promise.reject(proposalResponses)
		}else {
			return Promise.resolve(result)
		}
	})
}
exports.installChaincode = installChaincode
