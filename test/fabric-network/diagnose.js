const chaincodeId = 'diagnose';
const logger = require('khala-logger/log4js').consoleLogger('test:fabric-network:golang:diagnose');
const {getContract} = require('./index');
const task = async () => {
	const {contract, gateway} = await getContract(chaincodeId);
	let transaction = contract.createTransaction('putRaw');
	await transaction.submit('key', 'value');
	await contract.submitTransaction('putRaw', 'key', 'value1');
	let result;
	transaction = contract.createTransaction('getRaw');
	result = await transaction.evaluate('key');
	logger.info(result.toString());
	result = await contract.evaluateTransaction('getRaw', 'key');
	logger.info(result.toString());
	gateway.disconnect();
};
task();

