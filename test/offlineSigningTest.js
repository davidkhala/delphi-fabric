const helper = require('../app/helper');
const channelName = 'allchannel';

const offlineCC = require('../common/nodejs/offline/chaincode');
const User = require('../common/nodejs/user');
const Client = require('../common/nodejs/client');
const Eventhub = require('../common/nodejs/eventHub');
const {emptyChannel} = require('../common/nodejs/offline/channel');
const task = async () => {

	// Environment section
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
	// Environment section


	const {proposal, transactionID} = offlineCC.unsignedTransactionProposal(channelName, {fcn, args, chaincodeId}, mspId, certificate);
	const proposalBytes = proposal.toBuffer();
	const signedProposal = {
		signature: User.sign(user, proposalBytes),
		proposal_bytes: proposalBytes
	};
	const proposalResponses = await offlineCC.sendSignedProposal(peers, signedProposal);
	const commit = offlineCC.unsignedTransaction(channelName, proposalResponses, proposal);
	const commitBytes = commit.toBuffer();
	const signedTransaction = {
		signature: User.sign(user, commitBytes),
		proposal_bytes: commitBytes
	};
	const response = await offlineCC.sendSignedTransaction(signedTransaction, orderer);

	const channel = emptyChannel(channelName);
	const eventHub = new Eventhub(channel, peers[0]);


	const unsignedEvent = eventHub.unsignedRegistration(certificate, mspId);
	const signedEvent = {
		signature: User.sign(user, unsignedEvent),
		payload: unsignedEvent
	};

	await eventHub.connect({signedEvent});
	eventHub.txEvent({transactionID}, undefined, (tx, code, blockNum) => {
		console.log({tx, code, blockNum});
	}, (err) => {
		throw err;
	});

};
task();
