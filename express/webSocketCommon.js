const WebSocket = require('ws');

exports.newLogger = require('../common/nodejs/logger').new;
const logger = exports.newLogger('ws-common');
exports.wsStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
const wsMethods = ['open', 'message', 'close', 'error'];

exports.clearEventListener = (ws, method, listener) => {
	if (wsMethods.find((_) => _ === method)) {
		const listeners = ws.listeners(method);
		logger.debug('clearEventListener', method, listener ? 'of specific listener' : 'batch','original size',listeners.length);
		for (let listenerEach of listeners) {
			if (listener) {
				if (listenerEach === listener) {
					ws.removeEventListener(method, listenerEach);
					break;
				} else continue;
			} else {
				ws.removeEventListener(method, listenerEach);
			}
		}

	}
};

const instantWS = ({wsUrl, options = {}, sendContent}, onMessage) => {

	const ws = persistWS({wsUrl, options});

	ws.on('message', (data) => {
		console.log(data);
		if (onMessage) onMessage(data);
		ws.close();
	});

	ws.on('open', (event) => {
		console.log('onOpen');
		ws.send(JSON.stringify(sendContent));
	});

	return ws;
};
exports.instantWS = instantWS;
const persistWS = ({wsUrl, options = {}}) => {

	const ws = new WebSocket(wsUrl, options);

	ws.on('error', err => {
		logger.error(err);
	});
	ws.on('close', event => {
		logger.debug('close');
	});


	return ws;
};

exports.persistWS = persistWS;
