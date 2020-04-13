const logger = require('khala-logger/log4js').consoleLogger('test:fabric-network');
const helper = require('../../app/helper');
const org = 'astri.org';
const mspid = 'ASTRIMSP';
const peer = helper.newPeer(0, org);
const orderer = helper.newOrderers()[0];
const channelName = 'allchannel';
const client = helper.getOrgAdmin(org);
const Gateway = require('../../common/nodejs/fabric-network/gateway');
const gateway = new Gateway();

const task = async (taskID) => {

	const {chaincodeId} = process.env;
	const network = await gateway.connect(client, channelName, peer, mspid, orderer);
	const contract = network.getContract(chaincodeId);

	switch (chaincodeId) {
		case 'diagnose':
			switch (parseInt(taskID)) {
				case 0: {

					let transaction = contract.createTransaction('putRaw');
					await transaction.submit('key', 'value');
					await contract.submitTransaction('putRaw', 'key', 'value1');
					let result;
					transaction = contract.createTransaction('getRaw');
					result = await transaction.evaluate('key');
					logger.info(result.toString());
					result = await contract.evaluateTransaction('getRaw', 'key');
					logger.info(result.toString());
				}
					break;
			}
			break;
		case 'nodeContracts':
			let result;
			switch (parseInt(taskID)) {
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
			logger.info(result);
			break;
	}
	gateway.disconnect();

};
module.exports = task(process.env.taskID);


