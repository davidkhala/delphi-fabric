import * as helper from '../../../app/helper.js';
import {ChaincodeDefinitionOperator} from '../../../app/chaincodeOperator.js';
import {prepareInstall} from '../../../app/chaincodeHelper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import ChaincodeAction from '../../../common/nodejs/chaincodeOperation.js';
import {filedirname} from '@davidkhala/light/es6.mjs';

const chaincodeID = 'external';
const logger = consoleLogger(`chaincode:${chaincodeID}`);

const gate = `AND('icddMSP.member')`;
const orderers = helper.newOrderers();
const orderer = orderers[0];
const init_required = false;
const {channel = 'allchannel'} = process.env;
filedirname(import.meta);
describe(`install and approve ${chaincodeID}`, function () {
	this.timeout(0);
	it('install', async () => {

		const [ccPack, id, t1] = prepareInstall(chaincodeID);
		logger.debug(ccPack, {id});
		const peers = [helper.newPeer(0, 'icdd')];
		const user = helper.getOrgAdmin('icdd');
		const chaincodeAction = new ChaincodeAction(peers, user);
		chaincodeAction.proposal.setInitRequired(init_required);
		await chaincodeAction.connect();
		const responses = await chaincodeAction.install(ccPack);


	});

	it('query installed & approve', async () => {

		const sequence = 1;
		const org = 'icdd';
		const admin = helper.getOrgAdmin(org);
		const peers = helper.newPeers([0], org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		await operator.queryInstalledAndApprove(chaincodeID, orderer, undefined, gate);
		console.debug(`done for org ${org}`);
		await operator.disconnect();

	});

});
describe(`commit ${chaincodeID}`, function () {

	this.timeout(0);
	const queryCommitReadiness = async (sequence, _gate) => {
		const org = 'icdd';
		const peers = helper.newPeers([0], org);
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		const readyState = await operator.checkCommitReadiness({name: chaincodeID, sequence}, _gate);
		logger.info(org, readyState);
	};
	it('query commit Readiness', async () => {
		await queryCommitReadiness(1, gate);
	});


	const commit = async (_chaincodeID, sequence, _gate) => {
		const org = 'icdd';
		const peers = [helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		await operator.commitChaincodeDefinition({name: _chaincodeID, sequence}, orderer, _gate);
	};
	it('commit', async () => {

		await commit(chaincodeID, 1, gate);
	});


	it('query definition', async () => {
		const org = 'icdd';
		const peers = [helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		const r1 = await operator.queryDefinition(chaincodeID);
		logger.debug(r1);
		logger.debug(r1[0].collections.config[0].static_collection_config);
		logger.debug(r1[0].collections.config[0].static_collection_config.endorsement_policy);
		const r2 = await operator.queryDefinition(chaincodeID);
		operator.disconnect();
	});


});

