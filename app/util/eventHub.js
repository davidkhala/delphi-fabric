exports.unRegisterAllEvents = (eventHub) => {
	eventHub._chaincodeRegistrants = {}
	eventHub._blockOnEvents = {}

	eventHub._blockOnErrors = {}
	eventHub._transactionOnEvents = {}
	eventHub._transactionOnErrors = {}
}

// state-ful client
exports.new = (client, { eventHubPort, tls_cacerts, pem, peer_hostName_full, host }) => {

	const Host = host ? host : 'localhost'
	const eventHub = client.newEventHub()// NOTE newEventHub binds to clientContext
	if (pem) {
		eventHub.setPeerAddr(`grpcs://${Host}:${eventHubPort}`, {
			pem,
			'ssl-target-name-override': peer_hostName_full
		})
	} else if (tls_cacerts) {
		eventHub.setPeerAddr(`grpcs://${Host}:${eventHubPort}`, {
			pem: fs.readFileSync(tls_cacerts).toString(),
			'ssl-target-name-override': peer_hostName_full
		})
	}
	else {
		//non tls
		eventHub.setPeerAddr(`grpc://${Host}:${eventHubPort}`)
	}
	return eventHub
}
exports.txEventPromise = (eventhub, { txId, eventWaitTime, timeOutErr }, validator) => {
	return new Promise((resolve, reject) => {
		const transactionID = txId.getTransactionID()
		eventhub.connect()
		const timerID = setTimeout(() => {
			eventhub.unregisterTxEvent(transactionID)
			eventhub.disconnect()
			reject(timeOutErr)
		}, eventWaitTime)

		eventhub.registerTxEvent(transactionID, (tx, code) => {
			clearTimeout(timerID)
			eventhub.unregisterTxEvent(transactionID)
			eventhub.disconnect()

			if (validator({ tx, code })) {
				resolve({ tx, code })
			} else {
				reject({ tx, code })
			}
		})
	})
}
