const express = require('express');
const router = express.Router();

const {newLogger} = require('./webSocketCommon');
const logger = newLogger('clinic');
const {
    errJson, newWS, send, setOnMessage,
    trimHKID, errCase, claimListHandler,
    onErr
} = require('./medicalCommon');
const connectionPool = {};

router.use((req, res, next) => {
    const route = "insurer";
    logger.debug(route, 'recv request', req.url, req.body);
    logger.debug(route, 'connectionPool', Object.keys(connectionPool));
    const {insurerID} = req.body;
    const wsID = insurerID;
    if (!connectionPool[wsID]) {
        const ws = newWS({wsID, route});
        connectionPool[wsID] = ws;

        ws.on('close', event => {
            logger.error(route, 'closeEvent', `delete connectionPool[${wsID}]`);
            delete connectionPool[wsID];
        });
    }

    res.locals.ws = connectionPool[wsID];

    next();
});
router.post('/policy/create', (req, res) => {
    const {HKID, IPN, startTime, endTime, maxPaymentAmount} = req.body;
    const trimmed = trimHKID(HKID);
    if (!trimmed) {
        res.send(errCase.invalidParam("HKID"));
        return;
    }
    const {ws} = res.locals;
    setOnMessage(ws, message => {
        res.send(message);
    }, onErr(res));
    send(ws, {
        fn: 'setPolicyRecords',
        args: [{policyNum: IPN, patientId: trimmed, startTime, endTime, maxAmount: maxPaymentAmount}]
    });
});
router.post('/policy/view', (req, res) => {
    const {HKID, IPN} = req.body;
    const {ws} = res.locals;

    let trimmed = undefined;
    if (HKID) {
        trimmed = trimHKID(HKID);
        if (!trimmed) {
            res.send(errCase.invalidParam("HKID"));
            return;
        }
    }

    setOnMessage(ws, (message) => {
        const {resp} = message;
        const policies = resp
            .filter(({policyNum}) => !IPN || (IPN === policyNum))
            .filter(({patientId}) => !trimmed || (trimmed === patientId))
            .map(({patientId, insurerId, policyNum, startTime, endTime, maxAmount}) => {
                return {
                    patientId,
                    insurerID: insurerId, IPN: policyNum,
                    startTime, endTime, maxPaymentAmount: maxAmount
                };
            });
        res.send(errJson({policies}, message));
    }, onErr(res));
    send(ws, {fn: 'getPolicyRecords'});
});


router.post('/voucher_claim/list', claimListHandler);
router.post('/voucher_claim/pay', (req, res) => {
    const {claimID, IPN, HKID, paymentAmount, time} = req.body;
    const trimmed = trimHKID(HKID);
    if (!trimmed) {
        res.send(errCase.invalidParam("HKID"));
        return;
    }
    const {ws} = res.locals;
    setOnMessage(ws, message => {
        res.send(message);
    }, onErr(res));
    send(ws, {
        fn: 'setVoucherPaymentRecords',
        args: [{policyNum: IPN, claimId: claimID, patientId: trimmed, amount: parseInt(paymentAmount), time}]
    });
});
module.exports = router;