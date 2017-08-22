//install chaincode does not require channel existence
'use strict'
const helper = require('./helper.js')
const logger = helper.getLogger('install-chaincode')

//allowedCharsChaincodeName = "[A-Za-z0-9_-]+"
// allowedCharsVersion       = "[A-Za-z0-9_.-]+"
//
const installChaincode = function(peerIndexes, chaincodeName, chaincodePath,
																	chaincodeVersion, org) {
	logger.debug(
			'\n============ Install chaincode on organizations ============\n')
	logger.debug({ peerIndexes, chaincodeName, chaincodePath, chaincodeVersion, org })
	helper.setGOPATH()
	const client = helper.getClient()

	return helper.getOrgAdmin(org).then((user) => {
		const request = {
			targets: helper.newPeers(peerIndexes,org),
			chaincodePath: chaincodePath,
			chaincodeId: chaincodeName,
			chaincodeVersion: chaincodeVersion
		}
		return client.installChaincode(request)
	}).then((results) => {
		const proposalResponses = results[0]
		let all_good = true
		for (let proposalResponse of proposalResponses) {
			if (proposalResponse.response &&
					proposalResponse.response.status === 200) {
				logger.info('install proposal was good')
			} else {
				all_good = false
				logger.error('install proposal was bad')
			}
		}
		if (all_good) {
			const returnStr = `Successfully Installed chaincode on organization  ${org}`
			logger.info(
					`Successfully sent install Proposal and received ProposalResponse: Status - ${proposalResponses[0].response.status}`)
			logger.debug(returnStr)
			return returnStr
		} else {
			logger.error(
					'Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...')
			return 'Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...'
		}
	})
}
exports.installChaincode = installChaincode
