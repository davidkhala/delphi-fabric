const helper = require('../../app/helper');
const org = 'astri.org';
const mspid = 'ASTRIMSP';
const peer = helper.newPeer(0, org);
const orderer = helper.newOrderers()[0];
const channelName = 'allchannel';
const client = helper.getOrgAdmin(org);
const Gateway = require('../../common/nodejs/fabric-network/gateway');
const gateway = new Gateway();

exports.getContract = async (chaincodeId) => {
	const network = await gateway.connect(client, channelName, peer, mspid, orderer);
	const contract = network.getContract(chaincodeId);
	return {contract, gateway};
};


