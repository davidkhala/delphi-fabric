const helper = require('../app/helper');
const channelName = 'allchannel';
const {unsignedTransactionProposal, sendSignedProposal, unsignedTransaction, sendSignedTransaction} = require('../common/nodejs/builder/transaction');

const UserManager = require('../common/nodejs/builder/user');
const ClientManager = require('../common/nodejs/builder/client');
const EventHub = require('../common/nodejs/builder/eventHub');
const {emptyChannel} = require('../common/nodejs/builder/channel');
const {serializeProposal, deserializeProposal, serializeToHex, deserializeFromHex, serializeProposalResponse, deserializeProposalResponse} = require('../common/nodejs/serialize');
const logger = require('khala-logger/log4js').consoleLogger('test:offline sign');
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
	const user = ClientManager.getUser(client);
	const userManager = new UserManager(undefined, user);
	const certificate = userManager.getCertificate();
	const orderer = helper.newOrderers()[0];
	// Environment section

	let serverInterface;

	// TODO decode proposal_bytes into grpc proposal
	{
		const {proposal, transactionID} = unsignedTransactionProposal(channelName, {
			fcn,
			args,
			chaincodeId
		}, mspId, certificate);
		const {bytes: proposalBytes, proposal: proposalHex} = serializeProposal(proposal);

		serverInterface = {
			proposal_bytes: serializeToHex(proposalBytes),
			proposal: proposalHex,
			transactionID
		};
	}
	const proposal = serverInterface.proposal;
	const transactionID = serverInterface.transactionID;
	logger.info(serverInterface);
	{
		const proposalBytes = deserializeFromHex(serverInterface.proposal_bytes);
		const signedProposal = {
			signature: userManager.sign(proposalBytes),
			proposal_bytes: proposalBytes
		};
		serverInterface = {
			transactionID,
			signature: serializeToHex(signedProposal.signature),
			proposal_bytes: serializeToHex(signedProposal.proposal_bytes),
			proposal
			//	peers information
		};
	}
	logger.info(serverInterface);
	{
		const signedProposal = {
			signature: deserializeFromHex(serverInterface.signature),
			proposal_bytes: deserializeFromHex(serverInterface.proposal_bytes)
		};
		const proposalResponses = await sendSignedProposal(peers, signedProposal);
		for (const proposalResponse of proposalResponses) {
			if (proposalResponse instanceof Error) {
				throw proposalResponse;
			}
		}
		serverInterface = {
			proposalResponses: proposalResponses.map(serializeProposalResponse)
		};
	}
	logger.info(serverInterface);
	{
		const proposalResponses = serverInterface.proposalResponses.map(deserializeProposalResponse);
		const unsignedTx = unsignedTransaction(proposalResponses, deserializeProposal(proposal));
		serverInterface = {
			unsignedTransaction: serializeToHex(unsignedTx.toBuffer())
		};
	}
	logger.info(serverInterface);
	{

		const unsignedTx = deserializeFromHex(serverInterface.unsignedTransaction);
		const signedTransaction = {
			signature: userManager.sign(unsignedTx),
			proposal_bytes: unsignedTx
		};

		serverInterface = {
			transactionID,
			signature: serializeToHex(signedTransaction.signature),
			proposal_bytes: serializeToHex(signedTransaction.proposal_bytes)
		};
	}
	logger.info(serverInterface);
	{

		const signedTransaction = {
			signature: deserializeFromHex(serverInterface.signature),
			proposal_bytes: deserializeFromHex(serverInterface.proposal_bytes)
		};
		const response = await sendSignedTransaction(signedTransaction, orderer);
		serverInterface = {
			broadcastResponse: response
		};
	}
	logger.info(serverInterface);
	{
		const channel = emptyChannel(channelName);
		const eventHub = new EventHub(channel, peers[0]);
		const unsignedEvent = eventHub.unsignedRegistration(certificate, mspId);
		serverInterface = {
			unsignedEvent: serializeToHex(unsignedEvent)
		};

	}
	logger.info(serverInterface);
	{
		const unsignedEvent = deserializeFromHex(serverInterface.unsignedEvent);
		const signedEvent = {
			signature: userManager.sign(unsignedEvent),
			payload: unsignedEvent
		};

		serverInterface = {
			transactionID,
			signature: serializeToHex(signedEvent.signature),
			payload: serializeToHex(signedEvent.payload)
		};
	}
	logger.info(serverInterface);
	{
		const signedEvent = {
			signature: deserializeFromHex(serverInterface.signature),
			payload: deserializeFromHex(serverInterface.payload)
		};

		const channel = emptyChannel(channelName);
		const eventHub = new EventHub(channel, peers[0]);
		await eventHub.connect({signedEvent});
		await new Promise((resolve, reject) => {
			eventHub.txEvent({transactionID}, undefined, (tx, code, blockNum) => {
				resolve({tx, code, blockNum});
			}, (err) => {
				reject(err);
			});
		});
		eventHub.disconnect();
	}
	logger.info(serverInterface);
	process.exit(0);// FIXME why this is hanging
};
task();