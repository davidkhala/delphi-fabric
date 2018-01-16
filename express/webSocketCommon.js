const WebSocket = require('ws')
const log4js = require('log4js')

const newLogger = (moduleName)=> {
    const logger = log4js.getLogger(moduleName)
    logger.level = 'debug'
    return logger
}
exports.newLogger = newLogger
const logger = newLogger('ws-common')
exports.wsStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
const wsMethods = ['open', 'message', 'close', 'error']

exports.clearEventListener = (ws, method) => {
    const listeners = ws.listeners(method)
    if (wsMethods.find((_) => _ === method)){
        logger.debug('clearEventListener', method)
        for (let listener of listeners) {
            ws.removeEventListener(method, listener)
        }
    }
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
