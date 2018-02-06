const {persistWS, wsStates, clearEventListener, newLogger} = require('./webSocketCommon');
const WebSocket = require('ws');
const logger = newLogger('medical-common');
const errJson = (json, {errCode, errMessage} = {errCode: 'success', errMessage: ''}) => {

    return Object.assign({errCode, errMessage}, json);
};
exports.errJson = errJson;

const onErr = (res) => {
    return (err) => {
        let status = 400;
        if (err.action === "onOpen") {
            // {"msg":"onOpen","state":"failed","err":"Error: already connected"}
            status = 409;
        }
        res.status(status).send(err);
    };
};
exports.onErr = onErr;

const errCase = {
    emptyResp: {errCode: 'success', errMessage: 'No records found'},
    invalidParam: (param) => {
        return {errCode: "fail", errMessage: `Invalid ${param}`};
    },
};
exports.errCase = errCase;
/**
 * consent is a consent action counter,0 =>false, >0 => true
 * @param consent
 * @returns {string}
 */
const getConsentStatus = (consent) => {
    if (consent > 0) {
        return "consent";
    } else {
        return "pending";
    }
};
exports.getConsentStatus = getConsentStatus;
const getPaymentStatus = (bool) => {
    if (bool) {
        return "paid";
    } else {
        return "unpaid";
    }
};
exports.getPaymentStatus = getPaymentStatus;
exports.newWS = ({wsID, route}) =>
    persistWS({
        wsUrl: `wss://10.6.64.242:3001/medical/${route}/${wsID}:password`,
        options: {
            rejectUnauthorized: false
        }
    });

/**
 *
 * @param ws
 * @param fn
 * @param args each empty object as array element ==> 1 request
 * @returns {*}
 */
const send = (ws, {fn, args = [{}]}) => {

    if (ws.readyState === WebSocket.OPEN) {
        logger.debug('send', {fn, args});
        ws.send(JSON.stringify({fn, args}));
    } else {
        logger.debug('state', wsStates[ws.readyState]);
        ws.on('open', () => {
            require('sleep').msleep(10);// FIXME waiting for Hyperledger enroll
            logger.debug(ws.url, ws.readyState, 'opened, send', JSON.stringify({fn, args}));

            ws.send(JSON.stringify({fn, args}));
        });
    }

    return ws;
};
exports.send = send;
/**
 *
 * @param ws
 * @param onMessage
 * @param onErr
 */
const setOnMessage = (ws, onMessage, onErr) => {
    const listener = (data) => {
        logger.debug('message', data);
        const {msg, index, state, resp, err} = JSON.parse(data);
        if (msg === 'txState') {
            ws.txState = state;
        } else {
            if (err) {
                logger.error(data);
                const errorWrapper = {
                    action: msg, index, errCode: state,
                    errMessage: err
                };
                if (onErr) {
                    onErr(errorWrapper);
                } else {
                    throw new Error(JSON.stringify(errorWrapper));
                }
            } else {
                onMessage({
                    action: msg,
                    index,
                    resp,
                    errCode: 'success',
                    errMessage: state
                });
            }
            clearEventListener(ws, 'message', listener);
        }
    };
    ws.on('message', listener);
};
exports.setOnMessage = setOnMessage;


exports.trimHKID = (hkid) => {
    return hkid.replace(new RegExp(/\(/, 'g'), '').replace(new RegExp(/\)/, 'g'), '');
    const strValidChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    // basic check length
    const rawLength = hkid.length;
    if (rawLength < 8)
        return false;

    let trimHKID = hkid;
    // handling bracket
    if (hkid.charAt(rawLength - 3) === '(' && hkid.charAt(rawLength - 1) === ')')
        trimHKID = hkid.substring(0, rawLength - 3) + hkid.charAt(rawLength - 2);

    // convert to upper case
    trimHKID = trimHKID.toUpperCase();


    // regular expression to check pattern and split
    const hkidPat = /^([A-Z]{1,2})([0-9]{6})([A0-9])$/;
    const matchArray = trimHKID.match(hkidPat);

    // not match, return false
    if (matchArray == null)
        return false;

    // the character part, numeric part and check digit part
    const charPart = matchArray[1];
    const numPart = matchArray[2];
    const checkDigit = matchArray[3];

    // calculate the checksum for character part
    let checkSum = 0;
    if (charPart.length === 2) {
        checkSum += 9 * (10 + strValidChars.indexOf(charPart.charAt(0)));
        checkSum += 8 * (10 + strValidChars.indexOf(charPart.charAt(1)));
    } else {
        checkSum += 9 * 36;
        checkSum += 8 * (10 + strValidChars.indexOf(charPart));
    }

    // calculate the checksum for numeric part
    for (let i = 0, j = 7; i < numPart.length; i++, j--)
        checkSum += j * numPart.charAt(i);

    // verify the check digit
    const remaining = checkSum % 11;
    const verify = remaining === 0 ? 0 : 11 - remaining;

    if (verify === parseInt(checkDigit) || (verify === 10 && checkDigit === 'A')) {
        return trimHKID;
    } else {
        return false;
    }
};

exports.claimListHandler = (req, res) => {
    const {claimID} = req.body;
    const {ws} = res.locals;

    setOnMessage(ws, (message) => {
        const {resp} = message;

        const claimMap = {};
        let promise = Promise.resolve();
        const targetResp = (claimID ? [resp.find(({claimId}) => {
                return claimId === claimID;
            })]
            : resp);
        targetResp.forEach(({
                                clinicId,
                                claimId,
                                time, token, briefDesc, fee, consent,
                                patientId, insurers
                            }) => {

            claimMap[claimId] = {
                clinicID: clinicId,
                claimID: claimId,
                visitToken: token,
                fee,
                claimTime: time,
                patientConsentStatus: getConsentStatus(consent),
                medicalProcedureDescription: briefDesc,
                insurers: []
            };

            insurers.forEach(({insurerId, policyNum}) => {
                promise = promise.then(() => new Promise((resolve, reject) => {
                    send(ws, {fn: 'getPolicyRecords', args: [{insurerId, policyNum, patientId}]});
                    setOnMessage(ws, message => {
                        const {resp} = message;
                        const policy = {
                            insurerID: insurerId,
                            IPN: policyNum
                        };
                        if (resp.length === 1) {
                            const {startTime, endTime, maxAmount} = resp[0];
                            policy.startTime = startTime;
                            policy.endTime = endTime;
                            policy.maxPaymentAmount = maxAmount;
                        }
                        resolve(policy);
                    }, (err) => {
                        reject(err);
                    });
                })).then((policy) => new Promise((resolve, reject) => {
                        send(ws, {
                            fn: 'getVoucherPaymentRecords',
                            args: [{insurerId, policyNum, claimId}]
                        });
                        setOnMessage(ws, message => {
                            const {resp} = message;
                            const insurer = {
                                policy,
                                paymentStatus: getPaymentStatus(false)
                            };

                            if (resp.length === 1) {
                                const {amount, time} = resp[0];
                                insurer.paymentStatus = getPaymentStatus(true);
                                insurer.paymentTime = time;
                                insurer.paymentAmount = amount;
                            }

                            claimMap[claimId].insurers.push(insurer);//anyway

                            resolve();
                        }, (err) => {
                            reject(err);
                        });

                    })
                );
            });


        });


        promise.then(() => {

            const voucher_claims = Object.keys(claimMap).map((key) => {
                return claimMap[key];
            });
            res.send(errJson({voucher_claims}));
        }).catch(err => {
            logger.error(err);
            if (err.action) {
                res.send(err);
            } else {
                res.send({errCode: 'syntax error', errMessage: err});
            }

            return Promise.reject(err);
        });

    }, onErr(res));
    send(ws, {fn: 'getVoucherClaimRecords'});
};