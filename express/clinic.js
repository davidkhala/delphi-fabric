const express = require('express')
const router = express.Router()
const visitToken = 'A123456(0)|clinic0001|1513044007425' // fixme
const BPI = 'BlockchainPolicyID'
const insurerID = 'AXA'

const prescription = 'aspirin'
const { errJson, newWSAction,PIBuild } = require('./medicalCommon')
const insurers = [
	{
		insurerID,
		BPI,

		'paymentStatus': 'claimed',
		'payment': {
			'paymentTime': 1513044007425,
			'paymentAmount': 1000,
			'maxPaymentAmount': 1000
		}
	}
]
const wsCommon = require('./websocketCommon')
router.post('/visit_registration/list', (req, res) => {
	console.log(req.url, req.body)
	const { clinicID, HKID } = req.body
	newWSAction({ fn: req.url, message: { clinicID, HKID } }, (message) => {
		const BPIs = ['BlockchainPolicyID']
		res.json(errJson({ BPIs, visitToken }))
	})

})
router.post('/policy/view', (req, res) => {
	console.log(req.url, req.body)
	const { BPIs: BPIsString } = req.body
	const BPIs = JSON.parse(BPIsString)
	newWSAction({ fn: req.url, message: { BPIs } }, (message) => {
		res.json(errJson({
			policies: [
				{
					BPI,
					insurerID,
					'startTime': 1513044007425,
					'endTime': 1513044007425
				}
			]
		}))
	})

})
router.post('/voucher_claim/create', (req, res) => {
	console.log(req.url, req.body)
	const { visitToken, insurers: insurersString, fee, prescription, claimID } = req.body
	const insurers = JSON.parse(insurersString)
	newWSAction({ fn: req.url, message: { visitToken, insurers, fee, prescription, claimID } }, (message) => {
		res.json(errJson({}))
	})
})
router.post('/voucher_claim/list', (req, res) => {
	console.log(req.url, req.body)
	const { clinicID, claimID } = req.body
	newWSAction({ fn: req.url, message: { clinicID, claimID } }, (message) => {
		res.json(errJson({
			voucher_claims: [
				{
					claimID,
					fee: 1000,
					insurers,
					patientConsentStatus:"claimed",
					'claimTime': 1513044107425,
					prescription
				}
			]
		}))
	})

})

module.exports = router