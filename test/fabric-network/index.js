const logger = require('khala-logger/log4js').consoleLogger('test:fabric-network');
const helper = require('../../app/helper');
const org1 = 'astri.org';
const org2 = 'icdd';

const orderer = helper.newOrderers()[0];
const channelName = 'allchannel';

const Gateway = require('../../common/nodejs/fabric-network/gateway');


const task = async (taskID) => {
	const user = helper.getOrgAdmin();
	const gateway = new Gateway(user);
	const {chaincodeId} = process.env;

	const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];

	for (const peer of peers) {
		await peer.connect();
	}
	await orderer.connect();

	let strategy;

	if (process.env.eventhub) {
		//TODO test for customized strategy
		strategy = true;
	}


	switch (chaincodeId) {
		case 'diagnose':
			switch (parseInt(taskID)) {
				case 0: {
					// chaincodeId=diagnose taskID=0 eventHub=true node test/fabric-network
					const network = await gateway.connect(channelName, peers, orderer, undefined, strategy);
					const contract = network.getContract(chaincodeId);

					let transaction = contract.createTransaction('putRaw');

					await transaction.submit('key', 'value');
					//
					//
					// await contract.submitTransaction('putRaw', 'key', 'value1');
					// let result;
					// transaction = contract.createTransaction('getRaw');
					// result = await transaction.evaluate('key');
					// logger.info(result.toString());

				}
					break;
				case 1: {
					// chaincodeId=diagnose taskID=1 node test/fabric-network
					const network = await gateway.connect(channelName, peers, orderer, undefined, strategy);
					const contract = network.getContract(chaincodeId);
					let transaction = contract.createTransaction('panic');
					await transaction.submit();
				}
					break;
				case 2: {
					// chaincodeId=diagnose taskID=2 node test/fabric-network
					const network = await gateway.connect(channelName, peers, undefined, undefined, undefined);
					const contract = network.getContract(chaincodeId);
					const result = await contract.evaluateTransaction('getRaw', 'key');
					logger.info(result.toString());
				}
					break;
				case 3: {
					// chaincodeId=diagnose taskID=3 eventHub=true node test/fabric-network
					const discoveryOrg = org1; //TODO
					const globalConfig = require('../../config/orgs.json');
					const {mspid: mspId} = globalConfig.organizations[discoveryOrg];
					const networkConfig = globalConfig;
					const getPeersByOrgNameCallback = (orgName) => {
						return helper.newPeers(undefined, orgName);
					};
					const discoveryOptions = {mspId, networkConfig, getPeersByOrgNameCallback};
					const network = await gateway.connect(channelName, [], orderer, discoveryOptions, strategy);
					const contract = network.getContract(chaincodeId);
					const result = await contract.submitTransaction('getRaw', 'key');
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


