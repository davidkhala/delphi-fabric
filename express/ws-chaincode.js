const helper = require('../app/helper.js')
const ClientUtil = require('../app/util/client')
const logger = require('../app/util/logger').new('ws-chaincode')
const { errorHandle } = require('./websocketCommon')

const { reducer } = require('../app/util/chaincode')
exports.invoke = ({ COMPANY, chaincodeId }, ws) => {
	const { invoke } = require('../app/invoke-chaincode.js')
	const invalid = require('./formValid').invalid(COMPANY)
	return (message) => {
		logger.debug('==================== INVOKE CHAINCODE ==================')
		const { fcn, args: argsString, orgName, peerIndex, channelName } = JSON.parse(message)
		const args = argsString ? JSON.parse(argsString) : []
		logger.debug({ chaincodeId, fcn, args, orgName, peerIndex, channelName })
		const invalidPeer = invalid.peer({ peerIndex, orgName })
		if (invalidPeer) return errorHandle(invalidPeer, ws)

		const invalidChannelName = invalid.channelName({ channelName })
		if (invalidChannelName) return errorHandle(invalidChannelName, ws)

		const invalidArgs = invalid.args({ args })
		if (invalidArgs) return errorHandle(invalidArgs, ws)

		const client = ClientUtil.new()
		helper.getOrgAdmin(orgName, client).then(() => {
			const channel = helper.prepareChannel(channelName, client)
			const peers = helper.newPeers([peerIndex], orgName)
			return invoke(channel, peers, {
				chaincodeId, fcn,
				args
			}).then((message) => {
				const data = reducer(message)
				const sendContent = JSON.stringify({ data: data.responses, status: 200 })
				ws.send(sendContent, (err) => {
					if (err) {
						logger.error(err)
					}
				})

			}).catch(err => {
				logger.error(err)
				const { proposalResponses } = err
				if (proposalResponses) {
					errorHandle(proposalResponses, ws)
				} else {
					errorHandle(err, ws)
				}
			})
		})

	}
}
exports.instantiate = ({ COMPANY, chaincodeId }, ws) => {
	const invalid = require('./formValid').invalid(COMPANY)

	const { instantiate } = require('../app/instantiate-chaincode')
	return (message) => {
		logger.debug('==================== INSTANTIATE CHAINCODE ==================')

		const { chaincodeVersion, channelName, fcn, args: argsString, peerIndex, orgName } = JSON.parse(message)

		logger.debug({ channelName, chaincodeId, chaincodeVersion, fcn, argsString, peerIndex, orgName })
		const args = argsString ? JSON.parse(argsString) : []
		const invalidPeer = invalid.peer({ orgName, peerIndex })
		if (invalidPeer) return errorHandle(invalidPeer, ws)

		const invalidChannelName = invalid.channelName({ channelName })
		if (invalidChannelName) return errorHandle(invalidChannelName, ws)

		const invalidArgs = invalid.args({ args })
		if (invalidArgs) return errorHandle(invalidArgs, ws)
		const client = ClientUtil.new()
		return helper.getOrgAdmin(orgName, client).then(() => {
			const channel = helper.prepareChannel(channelName, client)
			const peers = helper.newPeers([peerIndex], orgName)
			return instantiate(channel, undefined, {
				chaincodeId, chaincodeVersion, fcn,
				args
			}).then((_) => {
				const sendContent = JSON.stringify(
						{ data: `instantiate request has been processed successfully with ${message}`, status: 200 })
				ws.send(sendContent, (err) => {
					if (err) {
						logger.error(err)
					}
				})
			}).catch(err => {
				const { proposalResponses } = err
				if (proposalResponses) {
					errorHandle(proposalResponses, ws)
				} else {
					errorHandle(err, ws)
				}
			})
		})
	}
}
exports.upgrade = ({ COMPANY, chaincodeId }, ws) => {
	const invalid = require('./formValid').invalid(COMPANY)

	const { upgrade } = require('../app/instantiate-chaincode')
	return (message) => {
		logger.debug('==================== upgrade CHAINCODE ==================')

		const { chaincodeVersion, channelName, fcn, args: argsString, peerIndex, orgName } = JSON.parse(message)
		const args = argsString ? JSON.parse(argsString) : []
		logger.debug({ channelName, chaincodeId, chaincodeVersion, fcn, args, peerIndex, orgName })
		const invalidPeer = invalid.peer({ orgName, peerIndex })
		if (invalidPeer) return errorHandle(invalidPeer, ws)
		const invalidChannelName = invalid.channelName({ channelName })
		if (invalidChannelName) return errorHandle(invalidChannelName, ws)

		const invalidArgs = invalid.args({ args })
		if (invalidArgs) return errorHandle(invalidArgs, ws)
		const client = ClientUtil.new()
		helper.getOrgAdmin(orgName, client).then(() => {
			const channel = helper.prepareChannel(channelName, client)
			const peers = helper.newPeers([peerIndex], orgName)
			return upgrade(channel, undefined, {
				chaincodeId, chaincodeVersion, fcn,
				args
			}).then((_) => {
				const sendContent = JSON.stringify(
						{ data: `upgrade request has been processed successfully with ${message}`, status: 200 })
				ws.send(sendContent, (err) => {
					if (err) {
						logger.error(err)
					}
				})
			}).catch(err => {
				const { proposalResponses } = err
				if (proposalResponses) {
					errorHandle(proposalResponses, ws)
				} else {
					errorHandle(err, ws)
				}
			})
		})
	}
}