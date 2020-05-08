const logger = require('khala-logger/log4js').consoleLogger('test:fabric-network');
const helper = require('../../app/helper');
const org1 = 'astri.org';
const org2 = 'icdd';

const orderer = helper.newOrderers()[0];
const channelName = 'allchannel';

const Gateway = require('../../common/nodejs/fabric-network/gateway');
const gateway = new Gateway();

const task = async (taskID) => {
	const client = helper.getOrgAdmin(org1);
	const {chaincodeId} = process.env;

	const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];

	let discoveryOptions, strategy;
	if (process.env.discovery) {
		const discoveryOrg = org1; //TODO
		const globalConfig = require('../../config/orgs.json');
		const {mspid: mspId} = globalConfig.organizations[discoveryOrg];
		const networkConfig = globalConfig;
		const getPeersByOrgNameCallback = (orgName) => {
			return helper.newPeers(undefined, orgName);
		};
		discoveryOptions = {mspId, networkConfig, getPeersByOrgNameCallback};

	}
	if (process.env.eventhub) {
		//TODO test for customized strategy
		strategy = true;
	}
	const network = await gateway.connect(client, channelName, peers, orderer, discoveryOptions, strategy);
	const contract = network.getContract(chaincodeId);

	switch (chaincodeId) {
		case 'diagnose':
			switch (parseInt(taskID)) {
				case 0: {
					// discovery=true chaincodeId=diagnose taskID=0 eventHub=true node test/fabric-network
					let transaction = contract.createTransaction('putRaw');

					await transaction.submit('key', 'value');


					await contract.submitTransaction('putRaw', 'key', 'value1');
					let result;
					transaction = contract.createTransaction('getRaw');
					result = await transaction.evaluate('key');
					logger.info(result.toString());

				}
					break;
				case 1: {
					// chaincodeId=diagnose taskID=1 node test/fabric-network
					let transaction = contract.createTransaction('panic');
					await transaction.submit();
				}
					break;
				case 2: {
					// chaincodeId=diagnose taskID=2 node test/fabric-network
					const network = await gateway.connect(client, channelName, peers, undefined,undefined,undefined );
					const contract = network.getContract(chaincodeId);
					const result = await contract.evaluateTransaction('getRaw', 'key');
					logger.info(result.toString());
				}
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


