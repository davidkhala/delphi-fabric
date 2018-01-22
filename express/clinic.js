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
    const route = "clinic"
    logger.debug(route, 'recv request', req.url, req.body);
    logger.debug(route, 'connectionPool', Object.keys(connectionPool));
    const {clinicID} = req.body;
    const wsID = clinicID
    if (!connectionPool[wsID]) {
        const ws = newWS({wsID, route})
        connectionPool[wsID] = ws

        ws.on('close', event => {
            logger.error(route, 'closeEvent', `delete connectionPool[${wsID}]`);
            delete connectionPool[wsID]
        });
    }

    res.locals.ws = connectionPool[wsID]

    next()
})
router.post('/visit_registration/list', (req, res) => {
    const {HKID} = req.body
    const trimmed = trimHKID(HKID)
    if (!trimmed) {
        res.send(errCase.invalidParam("HKID"))
        return
    }

    const {ws} = res.locals;

    setOnMessage(ws, message => {
        const {resp} = message
        if (resp.length === 1) {
            const {token, insurers} = resp[0]
            const policies = insurers.map(({insurerId, policyNum}) => {
                return {IPN: policyNum, insurerID: insurerId}
            })
            res.send(errJson({policies, visitToken: token}, message))
        } else {
            res.send(errCase.emptyResp)
        }
    }, onErr(res))
    send(ws, {fn: 'getRegistrationRecords', args: [{patientId: trimmed}]})


})
router.post('/policy/view', (req, res) => {
    const {HKID, policies} = req.body
    const trimmed = trimHKID(HKID)
    if (!trimmed) {
        res.send(errCase.invalidParam("HKID"))
        return
    }
    const {ws} = res.locals;

    setOnMessage(ws, message => {
        const {resp} = message
        const policies = resp.map(({insurerId, policyNum, startTime, endTime, maxAmount}) => {
            return {IPN: policyNum, insurerID: insurerId, startTime, endTime, maxPaymentAmount: maxAmount}
        })

        res.send(errJson({policies}, message))
    }, onErr(res))

    send(ws, {
        fn: 'getPolicyRecords',
        args: (Array.isArray(policies) ? policies : JSON.parse(policies)).map(({IPN, insurerID}) => {
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
        res.send(errCase.invalidParam("HKID"))
        return
    }

    const {ws} = res.locals;

    setOnMessage(ws, message => {
        res.send(message)
    }, onErr(res))

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
                insurers: (Array.isArray(policies) ? policies : JSON.parse(policies)).map(({IPN, insurerID}) => {
                    return {insurerId: insurerID, policyNum: IPN}
                }),
            }]
    })

})

router.post('/voucher_claim/list', claimListHandler)


module.exports = router