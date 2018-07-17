const WebSocket = require('ws');
const logger = require('../common/nodejs/logger').new('ws-common');
exports.wsStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
const wsMethods = ['open', 'message', 'close', 'error'];

exports.currentListeners = (ws, method) => {
	return ws.listeners(method);
};
exports.clearEventListener = (ws, method, listener) => {
	if (wsMethods.find((_) => _ === method)) {
		const listeners = ws.listeners(method);
		logger.debug('clearEventListener', method, listener ? `of single on size:${listeners.length}` : 'batch');
		for (const listenerEach of listeners) {
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

exports.wsServerBuilder = (server, onMessage, onMessageError) => {
	const wss = new WebSocket.Server({server});

	const heartBeat = () => {
		const clientsArray = Array.from(wss.clients);
		logger.debug('ws heartBeat', 'clients pool size', clientsArray.length);
		//typeof wss.clients === 'Set'
		clientsArray.forEach((ws, index) => {
			if (!ws.id) {
				ws.id = index;
			}
			if (ws.isAlive === false) return ws.terminate();

			ws.isAlive = false;
			ws.ping(() => {
			});
		});
	};
	setInterval(heartBeat, 30000);

	wss.on('connection', (ws) => {
		ws.isAlive = true;
		logger.debug('connection');
		ws.on('pong', () => {
			ws.isAlive = true;
		});
		heartBeat();

		ws.on('message', async message => {

			logger.info(ws.id, 'ws received msg', message);
			try {
				const data = JSON.parse(message);
				if (data) {
					await onMessage(data, ws);
				}
			} catch (err) {
				logger.error(ws.id, 'ws message handle error', err);
				await onMessageError(err, ws);
			}

		});

		ws.on('error', err => {
			logger.error(ws.id, 'ws error', err);
			ws.close();
		});

		ws.on('close', code => {
			logger.info(ws.id, `ws closed due to ${ws.isAlive ? 'client' : 'timeout'}`, {code});
		});
	});
	return wss;

};

const instantWS = ({wsUrl, options = {}, sendContent}, onMessage) => {

	const ws = persistWS({wsUrl, options});

	ws.on('message', (data) => {
		if (onMessage) onMessage(data);
		ws.close();
	});

	ws.on('open', (event) => {
		logger.log('onOpen', {event});
		ws.send(JSON.stringify(sendContent));
	});

	return ws;
};
exports.instantWS = instantWS;
const persistWS = ({wsUrl, options = {}}) => {

	const ws = new WebSocket(wsUrl, options);

	ws.on('error', err => {
		logger.error('onError', {err});
	});
	ws.on('close', event => {
		logger.debug('onClose', {event});
	});


	return ws;
};

exports.persistWS = persistWS;
