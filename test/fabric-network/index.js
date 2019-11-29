const helper = require('../../app/helper');
const org = 'astri.org';
let mspid = 'ASTRIMSP';
const peer = helper.newPeer(0, org);
const orderer = helper.newOrderers()[0];
const channelName = 'allchannel';
let chaincodeId = 'diagnose';
const logger = require('khala-logger/dev').devLogger('test:fabric-network');
const task = async () => {
	const client = helper.getOrgAdmin(org);
	const Gateway = require('../../common/nodejs/fabric-network/gateway');
	const gateway = new Gateway();
	const network = await gateway.connect(client, channelName, peer, mspid, orderer);
	const contract = network.getContract(chaincodeId);
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
module.exports = task();

