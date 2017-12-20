const {instantWS, persistWS,wsStates,clearEventListener} = require('./websocketCommon')
const WebSocket = require('ws')
const log4js = require('log4js')
const logger = log4js.getLogger('medical-common')
logger.setLevel('DEBUG')
exports.errJson = (json, {errCode, errMessage} = {errCode: 'success', errMessage: ''}) => {
    return Object.assign({errCode, errMessage}, json)
}

exports.newWS = ({wsID}) =>
    persistWS({
        //10.6.88.130
        //10.6.64.244
        wsUrl: `wss://10.6.64.244:3001/${wsID}:password`,
        options: {
            rejectUnauthorized: false
        }
    })


exports.send = (ws, {fn, args = []}) => {

    if(ws.readyState === WebSocket.OPEN){
        logger.debug('send',{fn, args})
        ws.send(JSON.stringify({fn, args}))
    }else {
        logger.debug('state',wsStates[ws.readyState])
        ws.on('open',()=>{
            logger.debug('opened, send',{fn, args})
            ws.send(JSON.stringify({fn, args}))
        })
    }

    return ws
}
/**
 *
 * @param ws
 * @param onMessage
 */
exports.setOnMessage = (ws, onMessage) => {
    ws.on('message', (data) => {
        logger.debug('message',data)
        const {msg, index, state, resp,err} = JSON.parse(data)
        if (onMessage) onMessage({action: msg, errCode:state,errMessage: err?err:'', resp})
        clearEventListener(ws,'message')
    })
}

exports.PIBuild = (insurers) => {
    return insurers.map(({insurerID, IPN}) => `${insurerID}+${IPN}`)
}