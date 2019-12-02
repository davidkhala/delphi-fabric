const chaincodeId = 'nodeContracts';
const logger = require('khala-logger/dev').devLogger('test:fabric-network:node:contracts');
const {getContract} = require('./index');
const task = async () => {
	const {contract, gateway} = await getContract(chaincodeId);
	await contract.submitTransaction('stress:init');
	gateway.disconnect();
};
module.exports = task();

