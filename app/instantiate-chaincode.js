const helper = require('./helper.js');
const eventHelper = require('../common/nodejs/eventHub');
const chaincodeUtil = require('../common/nodejs/chaincode');
const logUtil = require('../common/nodejs/logger');
const Query = require('../common/nodejs/query');

/**
 *
 * @param channel
 * @param richPeers set to 'undefined' to target all peers in channel
 * @param chaincodeId
 * @param chaincodeVersion
 * @param args
 * @param fcn
 * @param client
 * @returns {Promise<any[]>}
 */
exports.instantiate = async (channel, richPeers = channel.getPeers(), {chaincodeId, chaincodeVersion, args, fcn = 'init'},
							 client = channel._clientContext) => {
	const logger = logUtil.new('instantiate-chaincode');
	logger.debug(
		{channelName: channel.getName(), peersSize: richPeers.length, chaincodeId, chaincodeVersion, args});

	//Error: Verifying MSPs not found in the channel object, make sure "intialize()" is called first.
	const {eventWaitTime} = channel;

	await channel.initialize();
	logger.info('channel.initialize() success', channel.getOrganizations());
	const txId = client.newTransactionID();
	const Policy = require('fabric-client/lib/Policy');
	const {Role, OrganizationUnit, Identity} = Policy.IDENTITY_TYPE; // TODO only option 'Role' has been implemented
	const roleType = 'member'; //member|admin

	const policyTypes = [
		'signed-by', (key) => key.match(/^\d+\-of$/)
	];
	const request = {
		chaincodeId,
		chaincodeVersion,
		args,
		fcn,
		txId,
		targets: richPeers// optional: if not set, targets will be channel.getPeers
		// , 'endorsement-policy': {
		// 	identities: [
		// 		{
		// 			[Role]: {
		// 				name: roleType,
		// 				mspId: ''
		// 			}
		// 		}],
		// 	policy: {}
		// }
		// 		`chaincodeType` : optional -- Type of chaincode ['golang', 'car', 'java'] (default 'golang')
	};
	const existSymptom = '(status: 500, message: chaincode exists';

	const [responses, proposal, header] = await channel.sendInstantiateProposal(request);

	const ccHandler = chaincodeUtil.chaincodeProposalAdapter('instantiate', proposalResponse => {
		const {response} = proposalResponse;
		if (response && response.status === 200) return {isValid: true, isSwallowed: false};
		if (proposalResponse instanceof Error && proposalResponse.toString().includes(existSymptom)) {
			logger.warn('swallow when existence');
			return {isValid: true, isSwallowed: true};
		}
		return {isValid: false, isSwallowed: false};
	});
	const {errCounter, swallowCounter, nextRequest} = ccHandler([responses, proposal, header]);
	const {proposalResponses} = nextRequest;
	if (errCounter > 0) {
		throw {proposalResponses};
	}
	if (swallowCounter === proposalResponses.length) {
		return {proposalResponses};
	}

	const promises = [];
	for (const peer of richPeers) {

		const client = await peer.peerConfig.eventHub.clientPromise;
		const eventHub = helper.bindEventHub(peer, client);
		const txPromise = eventHelper.txEventPromise(eventHub, {txId, eventWaitTime}, ({tx, code}) => {
			logger.debug('newTxEvent', {tx, code});
			return {valid: code === 'VALID', interrupt: true};
		});
		promises.push(txPromise);
	}

	const response = await channel.sendTransaction(nextRequest);
	logger.info('channel.sendTransaction', response);
	return await Promise.all(promises);
	//	NOTE result parser is not required here, because the payload in proposalresponse is in form of garbled characters.
};
exports.upgradeToCurrent = async (channel, richPeer, {chaincodeId, args, fcn}, client = channel._clientContext) => {
	const {chaincodes} = await Query.chaincodes.installed(richPeer, client);
	const foundChaincode = chaincodes.find((element) => element.name === chaincodeId);
	if (!foundChaincode) {
		return Promise.reject(`No chaincode found with name ${chaincodeId}`);
	}
	const {version} = foundChaincode;

	// [ { name: 'adminChaincode',
	// 	version: 'v0',
	// 	path: 'github.com/admin',
	// 	input: '',
	// 	escc: '',
	// 	vscc: '' } ]

	const chaincodeVersion = chaincodeUtil.nextVersion(version);
	return module.exports.upgrade(channel, [richPeer], {chaincodeId, args, chaincodeVersion, fcn}, client);
};
exports.upgrade = async (channel, richPeers = channel.getPeers(), {chaincodeId, chaincodeVersion, args, fcn},
						 client = channel._clientContext) => {

	const logger = logUtil.new('upgrade-chaincode');
	const {eventWaitTime} = channel;
	const txId = client.newTransactionID();
	const request = {
		chaincodeId,
		chaincodeVersion,
		args,
		txId,
		fcn
	};
	const existSymptom = '(status: 500, message: version already exists for chaincode ';


	const ccHandler = chaincodeUtil.chaincodeProposalAdapter('upgrade', proposalResponse => {
		const {response} = proposalResponse;
		if (response && response.status === 200) return {isValid: true, isSwallowed: false};
		if (proposalResponse instanceof Error && proposalResponse.toString().includes(existSymptom)) {
			logger.warn('swallow when existence');
			return {isValid: true, isSwallowed: true};
		}
		return {isValid: false, isSwallowed: false};
	});

	const [responses, proposal, header] = await channel.sendUpgradeProposal(request);
	const {errCounter, swallowCounter, nextRequest} = ccHandler([responses, proposal, header]);

	const {proposalResponses} = nextRequest;

	if (errCounter > 0) {
		throw  {proposalResponses};
	}
	if (swallowCounter === proposalResponses.length) {
		return {proposalResponses};
	}
	const promises = [];
	for (const peer of richPeers) {
		const peerOrgName = peer.peerConfig.orgName;
		const txPromise = helper.getOrgAdmin(peerOrgName).then((client) => {
			const eventHub = helper.bindEventHub(peer, client);
			return eventHelper.txEventPromise(eventHub, {txId, eventWaitTime}, ({tx, code}) => {
				logger.debug('newTxEvent', {tx, code});
				return {valid: code === 'VALID', interrupt: true};
			});
		});
		promises.push(txPromise);
	}

	await channel.sendTransaction(nextRequest);
	logger.info('channel.sendTransaction success');
	return await Promise.all(promises);
	//	NOTE result parser is not required here, because the payload in proposalresponse is in form of garbled characters.
};