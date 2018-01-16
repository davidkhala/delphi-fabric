const express = require('express');
const router = express.Router();
const {newLogger} = require('./webSocketCommon')
const logger = newLogger('patient')
const {errJson, newWS, send, setOnMessage, trimHKID, errCase, claimListHandler} = require('./medicalCommon');

const connectionPool = {};
router.use((req, res, next) => {
    logger.debug('recv request', req.url, req.body);
    logger.debug('connectionPool', Object.keys(connectionPool));
    const {HKID} = req.body;

    const trimmed = trimHKID(HKID)
    if (!trimmed) {
        res.send(errJson({}, errCase.invalidHKID))
        return
    }


    if (!connectionPool[trimmed]) {
        const ws = newWS({wsID: trimmed, route: "patient"})
        connectionPool[trimmed] = ws

        ws.on('close', event => {
            console.log(`close delete connectionPool[${trimmed}]`);
            delete connectionPool[trimmed]
        });
    }

    res.locals.ws = connectionPool[trimmed]


    next()
});

router.post('/policy/view', (req, res) => {

    const {IPN, insurerID} = req.body;
    const {ws} = res.locals;

    setOnMessage(ws, (message) => {
        const {resp} = message;
        if (resp) {

            const policies = resp
                .filter(({insurerId}) => !insurerID || (insurerID === insurerId))
                .filter(({policyNum}) => !IPN || (IPN === policyNum))
                .map(({insurerId, policyNum, startTime, endTime, maxAmount}) => {
                    return {
                        insurerID: insurerId, IPN: policyNum,
                        startTime, endTime, maxPaymentAmount: maxAmount
                    }
                })
            res.send(errJson({policies}, message))
        } else {
            res.send(errJson({}, message))
        }

    });
    send(ws, {fn: 'getPolicyRecords'})

});


router.post('/visit_registration/create', (req, res) => {

    const {visitToken, clinicID, policies} = req.body;

    const {ws} = res.locals;

    setOnMessage(ws, (message) => {

        res.send(errJson({}, message))
    });
    const insurers = JSON.parse(policies).map(({IPN, insurerID}) => {
        return {insurerId: insurerID, policyNum: IPN}
    })

    send(ws,
        {
            fn: 'setRegistrationRecords', args: [{
                clinicId: clinicID,
                token: visitToken,
                expireTime: 0,
                insurers
            }]
        }
    )

});

router.post('/voucher_claim/list', claimListHandler);

router.post('/voucher_claim/consent', (req, res) => {

    const {claimID} = req.body;
    const {ws} = res.locals;

    setOnMessage(ws, (message) => {
        res.send(errJson({}, message))
    });
    send(ws, {fn: 'setVoucherConsentRecords', args: [{claimId: claimID}]})


});

module.exports = router;