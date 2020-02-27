const chaincodeId = 'nodeContracts';
const {getContract} = require('./index');
const task = async () => {
	const {contract, gateway} = await getContract(chaincodeId);
	let result;
	switch (parseInt(process.env.taskID)) {
		case 0:
			await contract.submitTransaction('stress:init');
			break;
		case 1:
			result = await contract.submitTransaction('stress:panic');
			break;
		case 2:
			result = await contract.submitTransaction('panic');
			break;
		case 3:
			result = await contract.submitTransaction('any');
			break;
		case 4:
			result = await contract.submitTransaction('shimError');
			break;

	}
	console.info({result});
	gateway.disconnect();
};

task();

