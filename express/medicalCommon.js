const { instantWS, persistWS } = require('./websocketCommon')
exports.errJson = (json, { errCode, errMessage } = { errCode: 'success', errMessage: '' }) => {
	return Object.assign({ errCode, errMessage }, json)
}

exports.newWS = ({ wsID }) =>
		persistWS({
			wsUrl: `wss://10.6.88.130:3001/${wsID}:password`,
			options: {
				rejectUnauthorized: false
			}
		})

exports.send = (ws, { fn, args: [] }) => {
	ws.send({ fn, args })
	return ws
}
/**
 *
 * @param ws
 * @param onMessage
 */
exports.setOnMessage = (ws, onMessage =({msg,state,resp})=>{return {action:msg,errMessage: state, resp }}) => {
	ws.on('message', (data) => {
		console.log(data)
		const { msg, index, state, resp = [] } = data
		if (onMessage) onMessage({ action: msg, errMessage: state, resp })

	})
}

exports.PIBuild = (insurers) => {
	return insurers.map(({ insurerID, IPN }) => `${insurerID}+${IPN}`)
}