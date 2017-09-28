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
exports.blockEventPromise = (eventHub, { eventWaitTime, timeOutErr }, validator) => {

	const _validator = validator ? validator : ({ block }) => {
		return { valid: block.data.data.length === 1, interrupt: true }
	}
	return new Promise((resolve, reject) => {
		eventHub.connect() // NOTE no timeout for this
		const timerID = setTimeout(() => {
			eventHub.unregisterBlockEvent(block_registration_number)
			eventHub.disconnect()
			reject(timeOutErr)
		}, eventWaitTime)
		const block_registration_number = eventHub.registerBlockEvent((block) => {
			const { valid, interrupt } = _validator({ block })
			if (interrupt) {
				clearTimeout(timerID)
				eventHub.unregisterBlockEvent(block_registration_number)
				eventHub.disconnect()
			}
			if (valid) {
				resolve({ block })
			} else {
				reject({ block })
			}
		}, err => {
			eventHub.unregisterBlockEvent(block_registration_number)
			eventHub.disconnect()
			reject(err)
		})
	})
}
exports.txEventPromise = (eventHub, { txId, eventWaitTime, timeOutErr }, validator) => {
	const _validator = validator ? validator : ({ tx, code }) => {

		return { valid: code === 'VALID', interrupt: true }
	}
	const transactionID = txId.getTransactionID()
	return new Promise((resolve, reject) => {
		eventHub.connect() //NOTE no timeout for this
		const timerID = setTimeout(() => {
			eventHub.unregisterTxEvent(transactionID)
			eventHub.disconnect()
			reject(timeOutErr?timeOutErr:"txEventTimeout")
		}, eventWaitTime)

		eventHub.registerTxEvent(transactionID, (tx, code) => {
			const { valid, interrupt } = _validator({ tx, code })
			if (interrupt) {
				clearTimeout(timerID)
				eventHub.unregisterTxEvent(transactionID)
				eventHub.disconnect()
			}
			if (valid) {
				resolve({ tx, code })
			} else {
				reject({ tx, code })
			}
		}, err => {
			eventHub.unregisterTxEvent(transactionID)
			eventHub.disconnect()
			reject(err)
		})
	})
}
