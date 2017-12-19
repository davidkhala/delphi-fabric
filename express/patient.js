const express = require('express')
const router = express.Router()
const { errJson, newWS, PIBuild, send, setOnMessage } = require('./medicalCommon')

const connectionPool = {}
router.use((req, res, next) => {
	console.log(req.url, req.body)
	next()
})
router.post('/policy/view', (req, res) => {

	const { HKID, IPN, insurerID } = req.body  // insurers: array or single element

	const ws = connectionPool[HKID] ? connectionPool[HKID] : newWS({ wsID: HKID })

	setOnMessage(ws, (message) => {
		const { errMessage, resp: respTemp } = message
		const resp = respTemp[0]
		const { startTime, endTime, maxPaymentAmount } = resp
		res.send(errJson({ startTime, endTime, maxPaymentAmount }, { errMessage }))
	})
	send(ws, { fn: 'getPolicyRecords', args: [{ patientId: HKID, policyNum: IPN, insurerId: insurerID }] })

	ws.on('close', event => {
		console.log('close')
		delete connectionPool[HKID]
	})
})

router.post('/visit_registration/create', (req, res) => {

	const { HKID, visitToken, clinicID, insurers: insurersString } = req.body

	const ws = connectionPool[HKID] ? connectionPool[HKID] : newWS({ wsID: HKID })
	const insurers = JSON.parse(insurersString)
	const policyNums = PIBuild(insurers)

	setOnMessage(ws, (message) => {
		const { errMessage } = message
		res.send(errJson({}, { errMessage }))
	})
	send(ws,
			{ fn: 'setRegistrationRecord', args: [{ patientId: HKID, clinicId: clinicID, token: visitToken, policyNums }] }
	)
	ws.on('close', event => {
		console.log('close')
		delete connectionPool[HKID]
	})

})

router.post('/voucher_claim/list', (req, res) => {

	const { HKID, insurers: insurersString } = req.body
	const ws = connectionPool[HKID] ? connectionPool[HKID] : newWS({ wsID: HKID })
	const insurers = JSON.parse(insurersString)

	//subset filtering FIXME to discuss
	const policyNums = PIBuild(insurers)

	const IPNs = insurers.map(({ IPN }) => IPN)
	setOnMessage(ws, (message) => {

		const { errMessage, resp } = message

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
					BPI: bpIds[i],
					IPN: IPNs[i] ///NOTE: extra for patient API
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
	send(ws, { fn: 'getVoucherClaimRecords', args: [{ patientId: HKID, policyNums }] })

	ws.on('close', event => {
		console.log('close')
		delete connectionPool[HKID]
	})
})

router.post('/voucher_claim/consent', (req, res) => {

	const { HKID, claimID, insurers: insurersString } = req.body
	const ws = connectionPool[HKID] ? connectionPool[HKID] : newWS({ wsID: HKID })
	const insurers = JSON.parse(insurersString) // strict matching of BPIs in claimContents

	const policyNums = PIBuild(insurers)
	setOnMessage(ws, (message) => {
		const { errMessage, resp } = message
		res.send(errJson({}, { errMessage }))
	})
	send(ws, { fn: 'setVoucherConsentRecords', args: [{ patientId: HKID, claimId: claimID, policyNums }] })

	ws.on('close', event => {
		console.log('close')
		delete connectionPool[HKID]
	})
})

module.exports = router