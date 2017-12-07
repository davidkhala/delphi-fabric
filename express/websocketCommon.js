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