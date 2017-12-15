exports.pong = (ws, errCB) => {
	ws.send(JSON.stringify({ data: 'pong', status: 200 }), (err) => {
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
	ws.send(JSON.stringify({ data: err.toString(), status }), err => {
		if (err) {
			if (errCB) errCB(err)
		}
	})

}
const WebSocket = require('ws')

const instantWS = ({ wsUrl, options = {}, sendContent }, onMessage) => {

	const ws = persistWS({ wsUrl, options })

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
const persistWS = ({ wsUrl, options = {} }) => {

	const ws = new WebSocket(wsUrl, options)

	ws.on('error', err => {
		console.error(err)
	})
	ws.on('close', event => {
		console.log('close')
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
ping()