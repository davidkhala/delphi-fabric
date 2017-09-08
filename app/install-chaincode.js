//NOTE install chaincode does not require channel existence
const helper = require('./helper.js')
const logger = helper.getLogger('install-chaincode')

//allowedCharsChaincodeName = "[A-Za-z0-9_-]+"
// allowedCharsVersion       = "[A-Za-z0-9_.-]+"
//
const installChaincode = (peers, chaincodeName, chaincodePath, chaincodeVersion, orgName) => {
	logger.debug('============ Install chaincode ============')
	logger.debug({ peers_length:peers.length, chaincodeName, chaincodePath, chaincodeVersion, orgName })
	helper.setGOPATH()
	const client = helper.getClient()

	return helper.getOrgAdmin(orgName).then(() => {
		const request = {
			targets: peers,
			chaincodePath,
			chaincodeId: chaincodeName,
			chaincodeVersion
		}
		return client.installChaincode(request)
	}).then(results => {
		const proposalResponses = results[0]
		const errCounter=[] // NOTE logic: reject only when all bad
		for (let proposalResponse of proposalResponses) {
			if (proposalResponse.response &&
					proposalResponse.response.status === 200) {
				logger.info('install proposal was good', proposalResponse)
			} else {
				if (proposalResponse.toString().includes('exists')) {
					logger.warn('duplicate install proposal', proposalResponse)
				} else {
					logger.error('install proposal was bad', proposalResponse)
					errCounter.push(proposalResponse)
				}
			}
		}
		if(errCounter.length===proposalResponses.length){
			return Promise.reject(proposalResponses)
		}
		return Promise.resolve(proposalResponses)
	})
}
exports.installChaincode = installChaincode
