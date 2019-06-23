const {TokenClient} = require('../common/nodejs/fabToken');
const helper = require('../app/helper');
const {sleep} = require('../common/nodejs/helper').nodeUtil.helper();
/**
 *
 * @returns {Promise<TokenClient>}
 */
const prepare = async (org) => {
	const channelName = 'allchannel';
	const adminClient = await helper.getOrgAdmin(org);
	const channel = helper.prepareChannel(channelName, adminClient, true);
	const peers = helper.newPeers([0], org);
	return new TokenClient(channel, peers);
};
const issueTest = async (org) => {
	const tokenClient = await prepare(org);
	const params = [
		{user: tokenClient.getUser(), type: 'EURO', quantity: 300},
		{user: tokenClient.getUser(), type: 'EURO', quantity: 300},
		{user: tokenClient.getUser(), type: 'EURO', quantity: 300}
	];
	const result = await tokenClient.issue(params);
	console.log('issueResult', result);
	await sleep(2000);
};
const listTest = async (org) => {
	const tokenClient = await prepare(org);
	return await tokenClient.list();
};
const redeemTest = async (utxos, org, quantity) => {
	console.log('[debug] token to redeem', utxos);
	const tokenClient = await prepare(org);

	await tokenClient.redeem(quantity, utxos);
	await sleep(2000);
};
const transferTest = async (utxos, org, targetOrg) => {
	console.log('[debug] transfer utxos', utxos);
	const tokenClient = await prepare(org);

	const targetUser = await helper.getOrgAdminUser(targetOrg);
	const params = [{user: targetUser, quantity: 400}, {user: tokenClient.getUser(), quantity: 200}];

	const result = await tokenClient.transfer(params, utxos);
	console.log('transfer result', result);
	await sleep(2000);
};

const test = async () => {
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	// await issueTest(org1);

	let org1Balance = await listTest(org1);
	let org2Balance;
	console.log(`org1 balance ${org1Balance.balance}`, org1Balance);
	await transferTest(org1Balance.slice(0, 2), org1, org2);
	org1Balance = await listTest(org1);
	org2Balance = await listTest(org2);
	console.log('org1 balance', org1Balance);
	console.log('org2 balance', org2Balance);
	await redeemTest(org1Balance.slice(0, 2), org1, 200);
	org1Balance = await listTest(org1);
	console.log(`org1 balance ${org1Balance.balance}`, org1Balance);
};
test();
