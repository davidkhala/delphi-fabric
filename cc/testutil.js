import * as helper from '../app/helper.js';
import {ChaincodeDefinitionOperator} from '../app/chaincodeOperator.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import UserBuilder from '../common/nodejs/admin/user.js';
import FabricGateway from '../common/nodejs/fabric-gateway/index.js';

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

export async function installAndApprove(org, chaincodeId, orderer, init_required = false) {
	const admin = helper.getOrgAdmin(org);

	const peers = helper.newPeers([0, 1], org);
	const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
	await operator.connect();
	const package_id = await operator.install(chaincodeId);
	await operator.queryInstalledAndApprove(chaincodeId, orderer, package_id);
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

export function getContract(chaincodeID) {
	const org = 'icdd';
	const peer = helper.newPeer(0, org);
	const user = new UserBuilder(undefined, helper.getOrgAdmin(org));

	const gateway = new FabricGateway(peer, user);
	return gateway.getContract(channel, chaincodeID);
}