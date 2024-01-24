import * as helper from '../app/helper.js';
import {ChaincodeDefinitionOperator} from '../app/installHelper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';

const channel = 'allchannel';

export async function dev(org, chaincodeID, init_required = false) {
	const admin = helper.getOrgAdmin(org);
	const logger = consoleLogger(`chaincode:${chaincodeID}`);
	const peers = helper.newPeers([0, 1], org);
	const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
	await operator.connect();
	const [installed, uncommitted, committed] = await operator.queryInstalled(chaincodeID);
	const definitions = await operator.queryDefinition(chaincodeID);
	logger.debug({installed, uncommitted, committed, definitions});
	await operator.disconnect();
}

export async function smartApprove(org, chaincodeID, orderer, init_required = false) {
	const admin = helper.getOrgAdmin(org);
	const peers = helper.newPeers([0, 1], org);
	const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
	await operator.connect();
	await operator.queryInstalledAndApprove(chaincodeID, orderer);
	await operator.disconnect();
}

export async function commit(org, chaincodeID, orderer, init_required = false) {
	const peers = helper.orgNamesOfChannel(channel).map(orgName => helper.newPeer(0, orgName));
	const admin = helper.getOrgAdmin(org);
	const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
	await operator.connect();
	await operator.queryAndCommit(chaincodeID, orderer);
	await operator.disconnect();
}
