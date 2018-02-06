const express = require('express');
const router = express.Router();
const {newLogger} = require('./webSocketCommon');
const logger = newLogger('patient');
const {
    errJson, newWS, send, setOnMessage, trimHKID, errCase, claimListHandler, onErr
} = require('./medicalCommon');

const connectionPool = {};
router.use((req, res, next) => {
    const route = "patient";
    logger.debug(route, 'recv request', req.url, req.body);
    logger.debug(route, 'connectionPool', Object.keys(connectionPool));
    const {HKID} = req.body;

    const trimmed = trimHKID(HKID);
    if (!trimmed) {
        res.send(errCase.invalidParam("HKID"));
        return;
    }
    const wsID = trimmed;

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

router.post('/policy/view', (req, res) => {

    const {IPN, insurerID} = req.body;
    const {ws} = res.locals;

    setOnMessage(ws, (message) => {
        const {resp} = message;
        const policies = resp
            .filter(({insurerId}) => !insurerID || (insurerID === insurerId))
            .filter(({policyNum}) => !IPN || (IPN === policyNum))
            .map(({insurerId, policyNum, startTime, endTime, maxAmount}) => {
                return {
                    insurerID: insurerId, IPN: policyNum,
                    startTime, endTime, maxPaymentAmount: maxAmount
                };
            });
        res.send(errJson({policies}, message));
    }, onErr(res));
    send(ws, {fn: 'getPolicyRecords'});

});


router.post('/visit_registration/create', (req, res) => {

    const {visitToken, clinicID, policies} = req.body;


    const {ws} = res.locals;

    setOnMessage(ws, (message) => {

        res.send(message);
    }, onErr(res));
    const insurers = (Array.isArray(policies) ? policies : JSON.parse(policies)).map(({IPN, insurerID}) => {
        return {insurerId: insurerID, policyNum: IPN};
    });

    send(ws,
        {
            fn: 'setRegistrationRecords', args: [{
                clinicId: clinicID,
                token: visitToken,
                expireTime: 0,
                insurers
            }]
        }
    );

});

router.post('/voucher_claim/list', claimListHandler);

router.post('/voucher_claim/consent', (req, res) => {

    const {claimID} = req.body;
    const {ws} = res.locals;

    setOnMessage(ws, (message) => {
        res.send(message);
    }, onErr(res));
    send(ws, {fn: 'setVoucherConsentRecords', args: [{claimId: claimID}]});


});

module.exports = router;