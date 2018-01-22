const express = require('express')
const router = express.Router()

const {newLogger} = require('./webSocketCommon')
const logger = newLogger('clinic')
const {
    errJson, newWS, send, setOnMessage,
    trimHKID, errCase, claimListHandler,
    onErr
} = require('./medicalCommon')
const connectionPool = {}

router.use((req, res, next) => {
    logger.debug('recv request', req.url, req.body);
    logger.debug('connectionPool', Object.keys(connectionPool));
    const {insurerID} = req.body;
    if (!connectionPool[insurerID]) {
        const ws = newWS({wsID: insurerID, route: "insurer"})
        connectionPool[insurerID] = ws

        ws.on('close', event => {
            console.log(`close delete connectionPool[${insurerID}]`);
            delete connectionPool[insurerID]
        });
    }

    res.locals.ws = connectionPool[insurerID]

    next()
})
router.post('/policy/create',(req,res)=>{
    const {HKID,IPN,startTime,endTime,maxPaymentAmount} = req.body
    const trimmed = trimHKID(HKID)
    if(!trimmed){
        res.send(errJson({},errCase.invalidHKID))
        return
    }
    const {ws} = res.locals
    setOnMessage(ws, message=>{
        res.send(message)
    },onErr(res))
    send(ws,{
        fn:'setPolicyRecords',
        args:[{policyNum:IPN,patientId:trimmed,startTime,endTime,maxAmount:maxPaymentAmount}]
    })
})
router.post('/voucher_claim/list',claimListHandler)
router.post('/voucher_claim/pay',(req,res)=>{
    const {HKID,IPN,claimID,paymentAmount} = req.body
    const time = new Date().getTime()
    const trimmed = trimHKID(HKID)
    if(!trimmed){
        res.send(errJson({},errCase.invalidHKID))
        return
    }
    const {ws} = res.locals
    setOnMessage(ws, message=>{
        res.send(message)
    },onErr(res))
    send(ws,{
        fn:'setVoucherPaymentRecords',
        args:[{policyNum:IPN,claimId:claimID,patientId:trimmed,amount:paymentAmount,time}]
    })
})
module.exports = router