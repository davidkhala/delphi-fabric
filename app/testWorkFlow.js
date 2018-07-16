const {invoke} = require('./chaincodeHelper');
const {reducer} = require('../common/nodejs/chaincode');
const helper = require('./helper');

const logger = require('../common/nodejs/logger').new('testWorkFLow');
const chaincodeId = 'trade';

const {genUser} = require('../config/caCryptoGen');
const peerIndexes = [0];

const fcnWalletCreate = 'walletCreate',
	fcnWalletBalance = 'walletBalance',
	fcnHistory = 'walletHistory',
	fcnTransfer = 'transfer',

	tt_new_eToken_issue = 'tt_new_eToken_issuance',
	tt_fiat_eToken_exchange = 'tt_fiat_eToken_exchange',
	tt_consumer_purchase = 'tt_consumer_purchase',
	tt_merchant_reject_purchase = 'tt_merchant_reject_purchase',
	tt_merchant_accept_purchase = 'tt_merchant_accept_purchase',
	tt = 'tt_unspecified',

	listPurchase = 'listPurchase',

	ConsumerType = 'c',
	MerchantType = 'm',
	ExchangerType = 'e';
const orgExchange = 'Exchange';
const orgMerchant = 'Merchant';
const orgConsumer = 'Consumer';
const DavidID = {Name: `david@${orgExchange}`, Type: ExchangerType};
const DavidExchange = async () => {
	return genUser({userName: 'david'}, orgExchange, false);
};
const LamID = {Name: `lam@${orgMerchant}`, Type: MerchantType};
const LamMerchant = async () => {
	return genUser({userName: 'lam'}, orgMerchant, false);
};
const StanleyID = {Name: `stanley@${orgConsumer}`, Type: ConsumerType};
const StanleyConsumer = async () => {
	return genUser({userName: 'stanley'}, orgConsumer, false);
};
const channelName = 'allchannel';


const arrayArgs = (argObjs) => argObjs.map(arg => JSON.stringify(arg));
const taskCreateAccount = async (id, org, user) => {
	try {
		const fcn = fcnWalletCreate;

		const args = arrayArgs([id]);
		const client = await helper.getOrgAdmin(org);
		const channel = helper.prepareChannel(channelName, client, true);
		const peers = helper.newPeers(peerIndexes, org);
		await invoke(channel, peers, {chaincodeId, fcn, args}, user);
	} catch (e) {
		logger.warn(e);
		if (e.proposalResponses.toString().includes('exist')) {
			//swallow
		} else throw e;
	}

};
const taskIssue = async () => {
	const fcn = tt_new_eToken_issue;
	const tx = {
		To: DavidID,
		Amount: 100,
		Type: tt_new_eToken_issue,
		TimeStamp: 0
	};
	const args = arrayArgs([DavidID, tx]);
	const client = await helper.getOrgAdmin(orgExchange);
	const channel = helper.prepareChannel(channelName, client, true);
	const peers = helper.newPeers(peerIndexes, orgExchange);
	const user = await DavidExchange();
	await invoke(channel, peers, {chaincodeId, fcn, args}, user);

};
const _taskBalance = async (id, org, user) => {
	const fcn = fcnWalletBalance;

	const args = arrayArgs([id]);
	const client = await helper.getOrgAdmin(org);
	const channel = helper.prepareChannel(channelName, client, true);
	const peers = helper.newPeers(peerIndexes, org);
	const {txEventResponses, proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args}, user);
	return reducer({txEventResponses, proposalResponses}).responses[0];
};

const taskHistory = async (id, org, user,) => {
	const fcn = fcnHistory;
	const filter = {
		Start: 0,
		End: new Date().getTime(),
	};
	const args = arrayArgs([id, {}, filter]);
	const client = await helper.getOrgAdmin(org);
	const channel = helper.prepareChannel(channelName, client, true);
	const peers = helper.newPeers(peerIndexes, org);
	const {txEventResponses, proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args}, user);
	return reducer({txEventResponses, proposalResponses}).responses[0];
};
const taskExchangeToken = async (id, org, user, Amount, toID) => {
	const fcn = tt_fiat_eToken_exchange;
	const tx = {
		To: toID,
		Amount,
		Type: tt_fiat_eToken_exchange,
		TimeStamp: 0
	};
	const args = arrayArgs([id, tx]);
	const client = await helper.getOrgAdmin(org);
	const channel = helper.prepareChannel(channelName, client, true);
	const peers = helper.newPeers(peerIndexes, org);
	await invoke(channel, peers, {chaincodeId, fcn, args}, user);
};
const taskTransfer = async (id, org, user, Amount, toID) => {
	const fcn = fcnTransfer;
	const tx = {
		To: toID,
		Amount,
		Type: tt,
		TimeStamp: 0
	};
	const args = arrayArgs([id, tx]);
	const client = await helper.getOrgAdmin(org);
	const channel = helper.prepareChannel(channelName, client, true);
	const peers = helper.newPeers(peerIndexes, org);
	await invoke(channel, peers, {chaincodeId, fcn, args}, user);
};
const taskPurchase = async (id, org, user, toID, {Amount, MerchandiseCode, MerchandiseAmount, ConsumerDeliveryInstruction}) => {

	const fcn = tt_consumer_purchase;
	const tx = {
		To: toID,
		Amount,
		Type: tt_consumer_purchase,
		TimeStamp: 0,
		MerchandiseCode,
		MerchandiseAmount,
		ConsumerDeliveryInstruction,
	};
	const args = arrayArgs([id, tx]);

	const client = await helper.getOrgAdmin(org);
	const channel = helper.prepareChannel(channelName, client, true);
	const peers = helper.newPeers(peerIndexes, org);
	await invoke(channel, peers, {chaincodeId, fcn, args}, user);
};
const taskAccept = async (id, org, user, PurchaseTxID) => {
	const fcn = tt_merchant_accept_purchase;
	const tx = {PurchaseTxID};
	const args = arrayArgs([id, tx]);
	const client = await helper.getOrgAdmin(org);
	const channel = helper.prepareChannel(channelName, client, true);
	const peers = helper.newPeers(peerIndexes, org);
	await invoke(channel, peers, {chaincodeId, fcn, args}, user);
};
const taskReject = async (id, org, user, PurchaseTxID) => {
	const fcn = tt_merchant_reject_purchase;
	const tx = {PurchaseTxID};
	const args = arrayArgs([id, tx]);
	const client = await helper.getOrgAdmin(org);
	const channel = helper.prepareChannel(channelName, client, true);
	const peers = helper.newPeers(peerIndexes, org);
	await invoke(channel, peers, {chaincodeId, fcn, args}, user);
};
const viewPurchase = async (id, {Start, End, Status}) => {
	let user;
	let org;
	const fcn = listPurchase;
	const filter = {
		Start, End, Status
	};
	switch (id) {
	case LamID:
		user = await LamMerchant();
		org = orgMerchant;
		break;
	case StanleyID:
		user = await StanleyConsumer();
		org = orgConsumer;
		break;
	default:
		return;
	}

	const args = arrayArgs([id, {}, filter]);

	const client = await helper.getOrgAdmin(org);
	const channel = helper.prepareChannel(channelName, client, true);
	const peers = helper.newPeers(peerIndexes, org);
	const {txEventResponses, proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args}, user);
	const records = reducer({txEventResponses, proposalResponses}).responses[0];
	const obj = JSON.parse(records).History;
	logger.info('purchases', id, obj);
	return obj;

};

const viewBalance = async (id) => {
	let user;
	let balance;
	switch (id) {
	case DavidID:
		user = await DavidExchange();
		balance = await _taskBalance(DavidID, orgExchange, user);
		logger.info('balance', DavidID, balance);
		return balance;
	case StanleyID:
		user = await StanleyConsumer();
		balance = await _taskBalance(StanleyID, orgConsumer, user);
		logger.info('balance', StanleyID, balance);
		return balance;
	case LamID:
		user = await LamMerchant();
		balance = await _taskBalance(LamID, orgMerchant, user);
		logger.info('balance', LamID, balance);
		return balance;
	default:

	}
};
const task = async () => {
	const userDavid = await DavidExchange();
	await taskCreateAccount(DavidID, orgExchange, userDavid);
	const userLam = await LamMerchant();
	await taskCreateAccount(LamID, orgMerchant, userLam);
	const userStanley = await StanleyConsumer();
	await taskCreateAccount(StanleyID, orgConsumer, userStanley);
	await taskIssue();
	await viewBalance(DavidID);

	await taskTransfer(DavidID, orgExchange, userDavid, 10, LamID);
	await viewBalance(DavidID);
	await viewBalance(LamID);

	const historyDavid = await taskHistory(DavidID, orgExchange, userDavid);
	logger.info('history', DavidID, historyDavid);
	await taskExchangeToken(DavidID, orgExchange, userDavid, 20, StanleyID);
	await taskExchangeToken(StanleyID, orgConsumer, userStanley, 10, DavidID);

	await taskPurchase(StanleyID, orgConsumer, userStanley, LamID, {
		Amount: 1,
		ConsumerDeliveryInstruction: '',
		MerchandiseCode: 'item1',
		MerchandiseAmount: 1,
	});
	await taskPurchase(StanleyID, orgConsumer, userStanley, LamID, {
		Amount: 1,
		ConsumerDeliveryInstruction: 'david address',
		MerchandiseCode: 'item2',
		MerchandiseAmount: 2,
	});
	let purchases;
	purchases = await viewPurchase(LamID, {});
	const purchasetxIDs = Object.keys(purchases);

	await taskAccept(LamID, orgMerchant, userLam, purchasetxIDs[0]);
	await viewPurchase(LamID, {});
	await taskReject(LamID, orgMerchant, userLam, purchasetxIDs[1]);
	await viewPurchase(StanleyID, {});

};
task();

