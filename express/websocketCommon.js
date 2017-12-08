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

const newWS = ({ wsUrl, sendContent }, onMessage) => {

	const ws = new WebSocket(wsUrl)

	ws.on('open', () => {
		console.log('onOpen')
		ws.send(JSON.stringify(sendContent))
	})

	ws.on('message', (data) => {
		console.log(data)
		if (onMessage) onMessage(data)
		ws.close()
	})
	ws.on('error',err=>{
		console.error(err)
	})
	ws.on('close',event=>{
		console.log('close')
	})
	return ws
}
exports.new = newWS
const ping = () =>
		newWS({
			wsUrl: 'wss://10.6.88.130:3001', sendContent: {
				'fn': 'getDegreeRecords', 'keys': [
					{ 'blockchainId': 'ChanTaiManId' }
				]
			}
		})

ping()