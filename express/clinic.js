const express = require('express')
const router = express.Router()

router.post('/voucher/claim', (req, res) => {
	const { clinic, hk_id, prescription, feeAmount, insurer, insurance_policy } = req.body
	const claimTime = new Date().getTime()


})
router.post('/voucher/list', (req, res) => {
	const { clinic } = req.body
})

module.exports = router