const helper = require('../app/helper');
const channelName = 'allchannel';

const offlineCC = require('../common/nodejs/offline/chaincode');
const User = require('../common/nodejs/user');
const Client = require('../common/nodejs/client');
const task = async () => {

	const orgName = 'astri.org';
	const client = helper.getOrgAdmin(orgName);
	const peers = helper.newPeers([0], orgName);
	const fcn = 'putRaw';
	const key = 'a';
	const value = 'b';
	const args = [key, value];
	const chaincodeId = 'diagnose';
	const mspId = 'ASTRIMSP';
	const user = Client.getUser(client);
	const certificate = User.getCertificate(user);
	const orderer = helper.newOrderers()[0];

	const {proposal} = offlineCC.unsignedTransactionProposal(channelName, {fcn, args, chaincodeId}, mspId, certificate);
	const proposal_bytes = proposal.toBuffer();
	const signature = User.sign(user, proposal_bytes);
	const signedProposal = {proposal_bytes, signature};
	const proposalResponses = await offlineCC.sendSignedProposal(peers, signedProposal);
	const commit = offlineCC.unsignedTransaction(channelName, proposalResponses, proposal);
	const signedTransaction = User.sign(user, commit.toBuffer());

	const response = await offlineCC.sendSignedTransaction(signedTransaction, orderer);
	console.log(response);
};
task();
