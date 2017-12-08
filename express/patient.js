const express = require('express')
const router = express.Router()

router.post('/visit/:clinic', (req, res) => {
	const { clinic } = req.params
	//visit code 9 digits
	const { insurer, hk_id, insurance_policy } = req.body

	res.send({ visitCode })

})

router.post('/insurance_policy/view', (req, res) => {
	const { insurer, hk_id, insurance_policy } = req.body
	const startDate = new Date().getTime()
	const endDate = new Date().getTime() + 10000
	res.send({ startDate, endDate,voucherAmount })
})
router.post('/insurance_policy/list', (req, res) => {
	const { insurer, hk_id} = req.body

	res.send([{insurance_policy }])
})
//Create/update an Access Rights record for the specified policy and the clinic
// router.post('/access/set', (req, res) => {
// 	const { insurer, insurance_policy, clinic, hk_id, access } = req.body
//
// 	res.send({})
// })
//
// // Returns all access rights records created by the patient for the specified policy
// router.post('/access/get', (req, res) => {
// 	const { insurer, insurance_policy, clinic, hk_id } = req.body
// 	const access = true
// 	res.send({ access })
// })
//view voucher claimed
router.post('/voucher/list', (req, res) => {
	const { insurer, insurance_policy, hk_id } = req.body
	res.send([{ voucher }])
})
router.post('/voucher/view', (req, res) => {
	const { voucher } = req.body
})
// router.post('/voucher/agree', (req, res) => {
// 	const { hk_id, voucher } = req.body
// })

module.exports = router