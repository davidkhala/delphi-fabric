const superagent = require('superagent')
const agent = require('superagent-promise')(superagent, Promise)
exports.encode = {
	configUpdate: (jsonString) => agent.post('http://127.0.0.1:7059/protolator/encode/common.ConfigUpdate', jsonString).
			buffer()
	,
	config: (jsonString) => agent.post('http://127.0.0.1:7059/protolator/encode/common.Config', jsonString).buffer()
}
exports.decode = {
	config: (data) => agent.post('http://127.0.0.1:7059/protolator/decode/common.Config', data).buffer()
}
exports.compute = {
	updateFromConfigs: (formData) => new Promise((resolve, reject) => {
		require('request').post({
			url: 'http://127.0.0.1:7059/configtxlator/compute/update-from-configs',
			formData
		}, function optionalCallback (err, res, body) {
			if (err) {
				reject(err)
			} else {
				resolve({ res, body })
			}
		})
	})

}
