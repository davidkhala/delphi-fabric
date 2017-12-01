//NOTE install chaincode does not require channel existence
const helper = require('./helper.js')

//allowedCharsChaincodeName = "[A-Za-z0-9_-]+"
// allowedCharsVersion       = "[A-Za-z0-9_.-]+"
//

const install = (peers, { chaincodeId, chaincodePath, chaincodeVersion }, client) => {
	const logger = require('./util/logger').new('install-chaincode')
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
		if (errCounter > 0) {
			return Promise.reject(proposalResponses)
		} else {
			return Promise.resolve(result)
		}
	})
}
exports.install = install

exports.updateInstall = (peers, { chaincodeId }, client) => {
	const Query = require('./query')

	const ChaincodeUtil = require('./util/chaincode')
	return Query.chaincodes.installed(peers[0], client).then(({ chaincodes }) => {
		const foundChaincode = chaincodes.find((element) => element.name === chaincodeId)
		if (!foundChaincode) {
			return Promise.reject(`No chaincode found with name ${chaincodeId}`)
		}
		const { version, path: chaincodePath } = foundChaincode

		// [ { name: 'adminChaincode',
		// 	version: 'v0',
		// 	path: 'github.com/admin',
		// 	input: '',
		// 	escc: '',
		// 	vscc: '' } ]

		const chaincodeVersion = ChaincodeUtil.nextVersion(version)
		return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client)
	})

}
exports.uninstall = (richPeers, { chaincodeId, chaincodeVersion }) => {
	const logger = require('./util/logger').new('uninstall-chaincode')

	const Dockerode = require('./util/dockerode')
	const promises = []
	for (let peer of richPeers) {
		const containerName = peer.peerConfig.containerName
		logger.debug(containerName)
		promises.push(Dockerode.uninstallChaincode({ containerName, chaincodeId, chaincodeVersion }))
	}
	return Promise.all(promises)

}
