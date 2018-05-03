const request = require('request');

const requestPost = (opt) => new Promise((resolve, reject) => {
	opt.encoding = null; // NOTE config :returning body to be of type Buffer not String
	request.post(opt, (err, res, body) => {
		if (err) {
			reject({ err });
		} else {
			resolve({ res, body });
		}
	});
});
exports.encode = {
	configUpdate: (jsonString) =>
		requestPost({
			url: 'http://127.0.0.1:7059/protolator/encode/common.ConfigUpdate',
			body: jsonString
		})
	,
	config: (jsonString) => requestPost(
		{ url: 'http://127.0.0.1:7059/protolator/encode/common.Config', body: jsonString })
};
exports.decode = {
	config: (data) => requestPost({ url: 'http://127.0.0.1:7059/protolator/decode/common.Config', body: data })
};
exports.compute = {
	updateFromConfigs: (formData) => requestPost({
		url: 'http://127.0.0.1:7059/configtxlator/compute/update-from-configs',
		formData
	}).then((resp) => {
		const bodyString = resp.body.toString();

		const noDiffErr = 'Error computing update: no differences detected between original and updated config';
		if (bodyString.includes(noDiffErr)) {
			//NOTE swallow it here
		}
		return resp;

	})
};
