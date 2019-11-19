const helper = require('../app/helper');
const channelName = 'allchannel';
const offlineCC = require('../common/nodejs/offline/chaincode');
const User = require('../common/nodejs/user');
const Client = require('../common/nodejs/client');
const task = async () => {

	const orgName = 'astri.org';
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client);
	const peers = helper.newPeers([0], orgName);
	const fcn = 'putRaw';
	const key = 'a';
	const value = 'b';
	const args = [key, value];
	const chaincodeId = 'diagnose';
	const mspId = 'ASTRIMSP';
	const user = Client.getUser(client);
	const certificate = User.getCertificate(user);

	const {proposal} = await offlineCC.generateUnsignedProposal(channel, {fcn, args, channelName, chaincodeId}, mspId, certificate);
	const proposalBytes = proposal.toBuffer();
	const signature = User.sign(user, proposalBytes);
	const result = await offlineCC.sendSignedProposal(peers, signature, proposalBytes);
	console.log(result);
};
task();
