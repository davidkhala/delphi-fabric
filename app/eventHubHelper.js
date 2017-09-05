exports.unRegisterAllEvents = (eventHub) => {
	eventHub._chaincodeRegistrants = {}
	eventHub._blockOnEvents = {}

	eventHub._blockOnErrors = {}
	eventHub._transactionOnEvents = {}
	eventHub._transactionOnErrors = {}
}