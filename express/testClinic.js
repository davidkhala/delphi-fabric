const express = require('express')
const http = require('http')
const path = require('path')
const bodyParser = require('body-parser')
const fs = require('fs')
const app = express()
app.use(bodyParser.json())
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
    extended: false
}))

const requestPromise = require('request-promise-native')
app.use("/clinic", require('./clinic'))
const port = 8080
const server = http.createServer(app).listen(port, function () {
})


const clinicID = "clinic0001"
const claimID = "claim0001"
const HKID = "A123456(0)"
const visitToken = "A123456(0)|clinic0001|1513044007425" // fixme
const BPI = "BlockchainPolicyID"
const BPIs = [BPI]
const insurerID = "AXA"
const insurers = [
    {
        visitToken,
        insurerID,
        BPI,

        "paymentStatus": "claimed",
        "payment": {
            "paymentTime": 1513044007425,
            "paymentAmount": 1000
        }
    }
]

const prescription = "aspirin"

const fee = 1000
//////////////

const promise0 = () => requestPromise({
    method: 'POST',
    uri: `http://localhost:${port}/clinic/visit_registration/list`,
    body: {
        clinicID, HKID
    },
    json: true
}).then(result => {
    console.log(JSON.stringify(result))
})

const promise1 = () => requestPromise({
    method: 'POST',
    uri: `http://localhost:${port}/clinic/policy/view`,
    body: {
        BPIs
    },
    json: true
}).then(result => {
    console.log(JSON.stringify(result))
})
const promise2 = () => requestPromise({
    method: 'POST',
    uri: `http://localhost:${port}/clinic/voucher_claim/create`,
    body: {
        claimID,visitToken, prescription, fee, insurers
    },
    json: true
}).then(result => {
    console.log(JSON.stringify(result))
})
const promise3 = () => requestPromise({
    method: 'POST',
    uri: `http://localhost:${port}/clinic/voucher_claim/list`,
    body: {
        clinicID
    },
    json: true
}).then(result => {
    console.log(JSON.stringify(result))
})
const promise4 = () => requestPromise({
    method: 'POST',
    uri: `http://localhost:${port}/clinic/voucher_claim/view`,
    body: {
        clinicID, claimID
    },
    json: true
}).then(result => {
    console.log(JSON.stringify(result))
})
promise0().then(promise1).then(promise2).then(promise3).then(promise4)
