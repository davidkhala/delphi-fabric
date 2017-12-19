const express = require('express')
const router = express.Router()
const visitToken = 'A123456(0)|clinic0001|1513044007425' // fixme
const BPI = 'BlockchainPolicyID'
const insurerID = 'AXA'

const prescription = 'aspirin'
const { errJson, newWS, PIBuild, send, setOnMessage } = require('./medicalCommon')
const connectionPool = {}

router.use((req, res, next) => {
	console.log(req.url, req.body)
	next()
})
router.post('/visit_registration/list', (req, res) => {
	const { clinicID, HKID } = req.body
	const ws = connectionPool[HKID] ? connectionPool[HKID] : newWS({ wsID: clinicID })

	setOnMessage(ws, message => {
		const { errMessage, resp: respTemp } = message
		const resp = respTemp[0]
		const { token, bpIds } = resp
		res.json(errJson({ BPIs: bpIds, visitToken: token }, { errMessage }))

	})
	send(ws, { fn: 'getRegistrationRecords', args: [{ patientId: HKID, clinicId: clinicID }] })
	ws.on('close', event => {
		console.log('close')
		delete connectionPool[HKID]
	})

})
router.post('/policy/view', (req, res) => {
	const { clinicID, BPIs: BPIsString } = req.body
	const ws = connectionPool[HKID] ? connectionPool[HKID] : newWS({ wsID: clinicID })

	const BPIs = JSON.parse(BPIsString)
	const args = BPIs.map(entry => {return { bpId: entry }})
	send(ws, { fn: 'getPolicyRecords', args })
	setOnMessage(ws, message => {
		const { errMessage, resp } = message
		res.json(errJson({ policies: resp }, { errMessage }))
	})

	ws.on('close', event => {
		console.log('close')
		delete connectionPool[HKID]
	})
})
router.post('/voucher_claim/create', (req, res) => {
	const { clinicID, visitToken, insurers: insurersString, fee, prescription, claimID } = req.body

	const insurers = JSON.parse(insurersString)
	const ws = connectionPool[HKID] ? connectionPool[HKID] : newWS({ wsID: clinicID })
	send(ws, {
		fn: 'setVoucherClaimRecords',
		args: [
			{
				claimId: claimID, clinicId: clinicID, token: visitToken, briefDesc: prescription, fee,
				insurerIds: insurers.map(({ insurerID }) => {return insurerID}),
				bpIds: insurers.map(({ BPI }) => {return BPI})
			}]
	})

	setOnMessage(ws, message => {
		const { errMessage } = message
		res.json(errJson({}, { errMessage }))
	})
	ws.on('close', event => {
		console.log('close')
		delete connectionPool[HKID]
	})
})
router.post('/voucher_claim/list', (req, res) => {
	const { clinicID, claimID } = req.body
	const ws = connectionPool[HKID] ? connectionPool[HKID] : newWS({ wsID: clinicID })

	send(ws, { fn: 'getVoucherClaimRecords', args: [{ clinicId: clinicID }] })

	setOnMessage(ws, (message) => {
		const { errMessage, resp} = message

		/**
		 * {claimId,bpId}
		 * @type {Array}
		 */
		const paymentListArgs = []
		const claimMap = {}
		(claimID ? [resp.find(({ claimId }) => {return claimId === claimID})]
				: resp).forEach(({
													 claimId, time, briefDesc, fee, insurerIds, bpIds, consent
												 }) => {

			const insurers = []
			for (let i = 0; i < insurerIds.length; i++) {
				insurers.push({
					insurerID: insurerIds[i],
					BPI: bpIds[i]
				})
				paymentListArgs.push({ claimId, bpId: bpIds[i] })
			}

			claimMap[claimId] = {
				claimID: claimId,
				fee,
				insurers,
				patientConsentStatus: consent,
				claimTime: time,
				prescription: briefDesc
			}
		})

		send(ws, { fn: 'getVoucherPaymentRecords', args: paymentListArgs })
		setOnMessage(ws, message => {
			const { errMessage, resp } = message
			for (let i = 0; i < resp.length; i++) {
				const response = resp[i]
				const { amount, time } = response
				const request = paymentListArgs[i]
				const { claimId, bpId } = request

				claimMap[claimId].insurers[i].payment = {
					paymentTime: time,
					paymentAmount: amount
				}
			}
			const voucher_claims = [Object.values(claimMap)]
			res.send(errJson({ voucher_claims }, { errMessage }))

		})
	})
	ws.on('close', event => {
		console.log('close')
		delete connectionPool[HKID]
	})
})

module.exports = router