const WebSocket = require('ws')
const log4js = require('log4js')
const logger = log4js.getLogger('ws-common')
logger.setLevel('DEBUG')

exports.wsStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
const wsMethods = ['open', 'message', 'close', 'error']
exports.pong = (ws, errCB) => {
    ws.send(JSON.stringify({data: 'pong', status: 200}), (err) => {
        if (err) {
            if (errCB) errCB(err)
        }
    })
}
exports.clearEventListener = (ws, method) => {
    const listeners = ws.listeners(method)
    if (wsMethods.find((_) => _ === method)){
        logger.debug('clearEventListener', method)
        for (let listener of listeners) {
            ws.removeEventListener(method, listener)
        }
    }
}
exports.errorHandle = (err, ws, errCB) => {
    const errorCodeMap = require('./errorCodeMap.json')

    let status = 500
    for (let errorMessage in errorCodeMap) {
        if (err.toString().includes(errorMessage)) {
            status = errorCodeMap[errorMessage]
            break
        }
    }
    ws.send(JSON.stringify({data: err.toString(), status}), err => {
        if (err) {
            if (errCB) errCB(err)
        }
    })

}


const instantWS = ({wsUrl, options = {}, sendContent}, onMessage) => {

    const ws = persistWS({wsUrl, options})

    ws.on('message', (data) => {
        console.log(data)
        if (onMessage) onMessage(data)
        ws.close()
    })

    ws.on('open', (event) => {
        console.log('onOpen')
        ws.send(JSON.stringify(sendContent))
    })

    return ws
}
exports.instantWS = instantWS
const persistWS = ({wsUrl, options = {}}) => {

    const ws = new WebSocket(wsUrl, options)

    ws.on('error', err => {
        logger.error(err)
    })
    ws.on('close', event => {
        logger.debug('close')
    })


    return ws
}

exports.persistWS = persistWS
const ping = (hosts = ['google.com']) => {
    const Ping = require('ping')

    hosts.forEach((host) => {
        Ping.promise.probe(host).then((res) => {
            console.log(res)
        })
    })
}
