const express = require('express')
const router = express.Router()
const visitToken = "A123456(0)|clinic0001|1513044007425" // fixme
const BPI = "BlockchainPolicyID"
const insurerID = "AXA"
const claimID = "claim0001"
const prescription = "aspirin"
const insurers = [
    {
        insurerID,
        BPI,

        "paymentStatus": "claimed",
        "payment": {
            "paymentTime": 1513044007425,
            "paymentAmount": 1000
        }
    }
]
router.post('/visit_registration/list', (req, res) => {
    console.log(req.url,req.body)
    const {clinicID, HKID} = req.body
    const BPIs = ["BlockchainPolicyID"]
    res.json({BPIs, visitToken})
})
router.post('/policy/view', (req, res) => {
    console.log(req.url,req.body)
    const {BPIs: BPIsString} = req.body
    res.send(JSON.stringify([
        {
            BPI,
            insurerID,
            "startTime": 1513044007425,
            "endTime": 1513044007425
        }
    ]))
})
router.post('/voucher_claim/create', (req, res) => {
    console.log(req.url,req.body)
    const {visitToken, insurers: insurersString, fee,prescription,claimID} = req.body
    res.json({})
})
router.post('/voucher_claim/list', (req, res) => {
    console.log(req.url,req.body)
    const {clinicID} = req.body
    res.send(JSON.stringify([
        {
            claimID,
            visitToken,
            fee: 1000,
            insurers,
            "claimTime": 1513044107425,
            prescription
        }
    ]))
})
router.post('/voucher_claim/view', (req, res) => {
    console.log(req.url,req.body)
    const {clinicID, claimID} = req.body
    res.send({
        visitToken,
        insurers,
        "claimTime": 1513044107425,
        prescription
    })
})


module.exports = router