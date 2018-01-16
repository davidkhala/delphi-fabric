const express = require('express')
const router = express.Router()

const {newLogger} = require('./webSocketCommon')
const logger = newLogger('clinic')
const {
    errJson, newWS, send, setOnMessage,
    trimHKID, errCase, claimListHandler
} = require('./medicalCommon')
const connectionPool = {}

router.use((req, res, next) => {
    logger.debug('recv request', req.url, req.body);
    logger.debug('connectionPool', Object.keys(connectionPool));
    const {clinicID} = req.body;
    if (!connectionPool[clinicID]) {
        const ws = newWS({wsID: clinicID, route: "clinic"})
        connectionPool[clinicID] = ws

        ws.on('close', event => {
            console.log(`close delete connectionPool[${clinicID}]`);
            delete connectionPool[clinicID]
        });
    }

    res.locals.ws = connectionPool[clinicID]

    next()
})
router.post('/visit_registration/list', (req, res) => {
    const {HKID} = req.body
    const trimmed = trimHKID(HKID)
    if (!trimmed) {
        res.send(errJson({}, errCase.invalidHKID))
        return
    }

    const {ws} = res.locals;

    setOnMessage(ws, message => {
        const {resp} = message
        if (resp && resp.length === 1) {
            const {token, insurers} = resp[0]
            const policies = insurers.map(({insurerId, policyNum}) => {
                return {IPN: policyNum, insurerID: insurerId}
            })
            res.send(errJson({policies, visitToken: token}, message))
        } else {
            res.send(errJson({}), message)
        }
    })
    send(ws, {fn: 'getRegistrationRecords', args: [{patientId: trimmed}]})


})
router.post('/policy/view', (req, res) => {
    const {HKID, policies} = req.body
    const trimmed = trimHKID(HKID)
    if (!trimmed) {
        res.send(errJson({}, errCase.invalidHKID))
        return
    }
    const {ws} = res.locals;

    setOnMessage(ws, message => {
        const {resp} = message
        const policies = resp.map(({insurerId, policyNum, startTime, endTime, maxAmount}) => {
            return {IPN: policyNum, insurerID: insurerId, startTime, endTime, maxPaymentAmount: maxAmount}
        })

        res.send(errJson({policies}, message))
    })
    send(ws, {
        fn: 'getPolicyRecords',
        args: JSON.parse(policies).map(({IPN, insurerID}) => {
            return {insurerId: insurerID, policyNum: IPN, patientId: trimmed}
        })
    })

})
router.post('/voucher_claim/create', (req, res) => {
    const {
        claimID,
        claimTime,
        HKID,
        visitToken,
        medicalProcedureDescription,
        fee,
        policies
    } = req.body
    const trimmed = trimHKID(HKID)
    if (!trimmed) {
        res.send(errJson({}, errCase.invalidHKID))
        return
    }

    const {ws} = res.locals;

    send(ws, {
        fn: 'setVoucherClaimRecords',
        args: [
            {
                claimId: claimID,
                patientId: trimmed,
                time: claimTime,
                token: visitToken,
                briefDesc: medicalProcedureDescription,
                fee,
                insurers: JSON.parse(policies).map(({IPN, insurerID}) => {
                    return {insurerId: insurerID, policyNum: IPN}
                }),
            }]
    })

    setOnMessage(ws, message => {
        res.send(errJson({}, message))
    })

})

router.post('/voucher_claim/list', claimListHandler)


module.exports = router