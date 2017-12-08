const express = require('express')
const router = express.Router()

router.post('/voucher/list', (req, res) => {
	const { insurer } = req.body
})
const helper = require('../app/helper.js')
const ClientUtil = require('../app/util/client')
const logger = require('../app/util/logger').new('ws-chaincode')
const { errorHandle } = require('./websocketCommon')
const chaincodeId = 'medicalChaincode'

const { reducer } = require('../app/util/chaincode')
exports.invoke = ({ COMPANY }, ws) => {
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

router.post('/voucher/payment', (req, res) => {
	const { voucher, insurer, amount } = req.body
	const paymentTime = new Date().getTime()

})
const getBPI = () => {

}
router.post('/insurance_policy/create', (req, res) => {
	const { insurer, hk_id, amount, insurance_policy, startDate, endDate } = req.body
//	amount:Voucher_Amount_Per_Visit
	const BPI = getBPI({ hk_id })
	res.send({})
})

module.exports = router