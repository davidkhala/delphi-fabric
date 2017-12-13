exports.pong = (ws, errCB) => {
    ws.send(JSON.stringify({data: 'pong', status: 200}), (err) => {
        if (err) {
            if (errCB) errCB(err)
        }
    })
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
const WebSocket = require('ws')

const newWS = ({wsUrl, options, sendContent}, onMessage) => {

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const ws = new WebSocket(wsUrl, options)

    ws.on('open', (event) => {
        console.log('onOpen')
        ws.send(JSON.stringify(sendContent))
    })

    ws.on('message', (data) => {
        console.log(data)
        if (onMessage) onMessage(data)
        ws.close()
    })
    ws.on('error', err => {
        console.error(err)
    })
    ws.on('close', event => {
        console.log('close')
    })
    return ws
}
exports.new = newWS
const wsping = () =>
    newWS({
        wsUrl: 'wss://10.6.88.130:3001',
        options: {
            rejectUnauthorized: false
        },
        sendContent: {
            'fn': 'getDegreeRecords', 'keys': [
                {'blockchainId': 'ChanTaiManId'}
            ]
        }
    })

wsping()
const ping = (hosts = ['google.com']) => {
    const Ping = require('ping');

    hosts.forEach((host) => {
        Ping.promise.probe(host)
            .then((res) => {
                console.log(res);
            });
    });
}
ping()