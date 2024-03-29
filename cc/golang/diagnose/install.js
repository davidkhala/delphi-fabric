import * as helper from '../../../app/helper.js';
import {ChaincodeDefinitionOperator, installAll, installs} from '../../../app/installHelper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {allPeers} from '../../../app/helper.js';

const logger = consoleLogger('chaincode:diagnose');
const chaincodeID = 'diagnose';


const orderers = helper.newOrderers();
const orderer = orderers[0];
const gate = `AND('icddMSP.member')`;
const init_required = true;
const {channel = 'allchannel'} = process.env;

describe(`${chaincodeID} default: green path`, function () {
	this.timeout(0);
	it('install', async () => {
		await installAll(chaincodeID);
	});

	it('query installed', async () => {
		const orgs = ['icdd', 'astri.org'];
		for (const org of orgs) {
			const admin = helper.getOrgAdmin(org);
			const peers = helper.newPeers([0, 1], org);
			const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
			await operator.connect();

			await operator.queryInstalledAndApprove(chaincodeID, 1, orderer);


			await operator.disconnect();
		}

	});
});
describe(`commit ${chaincodeID}`, function () {

	this.timeout(0);
	const queryCommitReadiness = async (sequence, _gate) => {
		for (const org of ['icdd']) {
			const peers = helper.newPeers([0, 1], org);
			const admin = helper.getOrgAdmin(org);
			const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
			await operator.connect();
			const readyState = await operator.checkCommitReadiness({name: chaincodeID, sequence}, _gate);
			logger.info(org, readyState);
		}
	};

	it(`query commit Readiness: with gate ${gate}`, async () => {
		await queryCommitReadiness(1, gate);
	});

	const commit = async (_chaincodeID, sequence, _gate) => {
		const org = 'icdd';
		const peers = allPeers();
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();

		await operator.commitChaincodeDefinition({name: _chaincodeID, sequence}, orderer, _gate);

	};

	it(`commit: with gate ${gate}`, async () => {
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

describe('legacy chaincode Initialize', async function () {
	this.timeout(0);
	it('init', async () => {
		const org = 'icdd';
		const peers = helper.newPeers([0, 1], org);
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers);
		await operator.connect();
		await operator.init(chaincodeID);
		operator.disconnect();
	});
});

describe('upgrade:install, query,approve and commit  ', function () {
	this.timeout(0);
	it('query installed & approve: with gate', async () => {
		const sequence = 2;
		const org = 'icdd';
		const admin = helper.getOrgAdmin(org);
		const peers = helper.newPeers([0, 1], org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();

		await operator.queryInstalledAndApprove(chaincodeID, sequence, orderer, gate);


	});
});