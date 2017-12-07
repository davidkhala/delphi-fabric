exports.invalid = (COMPANY) => {
	const companyConfig = require('../config/orgs.json')[COMPANY]
	const channelsConfig = companyConfig.channels
	const orgsConfig = companyConfig.orgs
	const chaincodesConfig = require('../config/chaincode.json')

	const orgNameFcn = ({ orgName }) => {
		const orgConfig = orgsConfig[orgName]
		if (!orgConfig) {
			return `config of org '${orgName}' not found`
		}
		return false
	}
	return {
		orgName: orgNameFcn,
		channelName: ({ channelName }) => {
			const channelConfig = channelsConfig[channelName]
			if (!channelConfig) {
				return `config of channel '${channelName}' not found`
			}
			return false
		},
		peer: ({ orgName, peerIndex }) => {
			const invalidOrgname = orgNameFcn({ orgName })
			if (invalidOrgname) return invalidOrgname
			const orgConfig = orgsConfig[orgName]
			const peerConfig = orgConfig.peers[peerIndex]
			if (!peerConfig) {
				return `config of peer${peerIndex}.${orgName} not found`
			}
			return false
		},
		args: ({ args }) => {
			if (!Array.isArray(args)) {
				return `invalid Arguments:args must be an array but got:${args}`
			}
			return false
		},
		chaincodeVersion: ({ chaincodeVersion }) => {
			//TODO
		},
		chaincodeId: ({ chaincodeId }) => {
			const chaincodeConfig = chaincodesConfig.chaincodes[chaincodeId]
			if (!chaincodeConfig) {
				return `config of chaincode ${chaincodeId} not found`
			}
			return false
		}
	}
}

