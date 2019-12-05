const chaincodeId = 'nodeContracts';
const {getContract} = require('./index');
const task = async () => {
	const {contract, gateway} = await getContract(chaincodeId);
	await contract.submitTransaction('stress:init');
	gateway.disconnect();
};
module.exports = task();

