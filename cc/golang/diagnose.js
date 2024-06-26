import {commit, dev, getContract, installAndApprove} from '../testutil.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import * as helper from '../../app/helper.js';
import {ChaincodeDefinitionOperator} from '../../app/chaincodeOperator.js';
import assert from 'assert';
import {base64} from '@davidkhala/light/format.js';
import {TxValidationCode} from '../../common/nodejs/formatter/constants.js';
import {getResponses} from '../../common/nodejs/formatter/proposalResponse.js';

const logger = consoleLogger('chaincode:diagnose');
const chaincodeID = 'diagnose';
describe(`${chaincodeID} : green path`, function () {
	this.timeout(0);
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	it('validate', async () => {
		const orgs = ['icdd', 'astri.org'];
		for (const org of orgs) {
			await dev(org, chaincodeID);
		}
	});
	it('install & approve', async () => {
		const orgs = ['icdd', 'astri.org'];
		for (const org of orgs) {
			await installAndApprove(org, chaincodeID, orderer, true);
		}

	});
	it('commit', async () => {
		const org = 'icdd';
		await commit(org, chaincodeID, orderer, true);
	});
});

describe('variant', async function () {
	this.timeout(0);

	// TODO const gate = `AND('icddMSP.member')`;
	it('init', async () => {
		const org = 'icdd';
		const channel = 'allchannel';
		const peers = helper.allPeers();
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers);
		await operator.connect();
		await operator.init(chaincodeID);

		operator.disconnect();
	});
});


describe('chaincode query', () => {
	const contract = getContract(chaincodeID);
	it('whom am i ', async () => {
		const queryResult = await contract.evaluate(['whoami']);
		logger.info(queryResult);
		const {MspID, Attrs, CertificatePem} = JSON.parse(queryResult);
		assert.equal(MspID, 'icddMSP');
	});

	it('getCertID', async () => {
		const queryResult = await contract.evaluate(['getCertID']);
		assert.equal(queryResult, 'x509::CN=Admin,OU=client::CN=fabric-ca-server,OU=Fabric,O=Hyperledger,ST=North Carolina,C=US');
	});
	it('peerMSPID', async () => {
		const result = await contract.evaluate(['peerMSPID']);
		assert.equal(result, 'icddMSP');
	});
	it('chaincode ping (google.com)', async () => {
		const result = await contract.evaluate(['external']);
		assert.equal(result, '200 OK');
	});
});
describe('chaincode invoke', function () {
	this.timeout(0);
	const contract = getContract(chaincodeID);
	it('put & get raw value', async () => {
		const value = Date.now().toString();
		const key = 'a';
		await contract.submit(['putRaw', key, value]);
		const queryResult = await contract.evaluate(['getRaw', key]);
		assert.strictEqual(queryResult, value);
	});


	const batchMap = (size) => {
		const map = {};
		for (let i = 0; i < size; i++) {
			const iStr = `${i}`;
			const padded = iStr.padStart(3, '0');
			map[`key_${padded}`] = `${i}`;
		}
		return map;
	};

	it('putBatch', async () => {
		const size = 5;
		const map = batchMap(size);

		await diagnose.putBatch(map);
	});
	it('OverList: > 100', async () => {
		const map = batchMap(200);
		await diagnose.putBatch(map);
		const worldStatesResults = await diagnose.list();
		logger.debug(JSON.parse(worldStatesResults).length);
	});
	it('put and get:for couchdb index', async () => {
		const key = 'a';
		await diagnose.put(key, 'b');
		const gotValue = await diagnose.get(key);
		logger.debug('get response', gotValue[0]);
	});
	it('key-level endorsement: set to single', async () => {
		const endorseKey = 'a';
		const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
		const orderer = helper.newOrderers()[0];
		await diagnose.putEndorsement(peers, orderer, endorseKey, ['icddMSP']);
		const endorsingOrgs = await diagnose.getEndorsement(endorseKey);
		logger.info('endorsingOrgs', endorsingOrgs);

		// TODO observe the behavior of endorsing hack
		// await diagnose.put(endorseKey, 'endorsing hack');
	});
	const singleEndorseShouldFail = async (endorseKey) => {
		try {
			await diagnose.put(endorseKey, 'endorsing hack');
			assert.fail('expect endorsing error');

		} catch (e) {
			logger.info('expect endorsing error', e);
		}
	};
	const multiEndorseShouldSuccess = async (endorseKey) => {
		await diagnose.put(endorseKey, 'endorsing good');

	};
	it('key-level endorsement set correct', async () => {
		const endorseKey = 'a';

		await diagnose.putEndorsement(endorseKey, ['astriMSP', 'icddMSP']);
		const endorsingOrgs = await diagnose.getEndorsement(endorseKey);
		logger.info('endorsingOrgs', endorsingOrgs);
		// await singleEndorseShouldFail(endorseKey);
		// await multiEndorseShouldSuccess(endorseKey);

	});
	it('key-level endorsement: delete', async () => {
		const endorseKey = 'a';
		await diagnose.putEndorsement(endorseKey);
		const endorsingOrgs = await diagnose.getEndorsement(endorseKey);
		logger.info('endorsingOrgs', endorsingOrgs);
		await singleEndorseShouldFail(endorseKey);
		await multiEndorseShouldSuccess(endorseKey);
	});
});
describe('couchdb', () => {
	const key = 'david';
	const value = 'khala';
	it('write', async () => {

		await diagnose.put(key, value);
		// validate write
		const result = await diagnose.get(key);
		console.debug(result);
	});

	it('read', async () => {

		const results = await diagnose.richQuery(org1);
		for (const result of results) {
			const {Namespace, Key, Value} = JSON.parse(result)[0];
			assert.strictEqual(Namespace, 'diagnose');
			assert.strictEqual(Key, key);
			const {Time, Value: valueRaw} = JSON.parse(Value);
			assert.strictEqual(JSON.parse(base64.decode(valueRaw)), value);
		}

		// Error:no_usable_index,  Status Code:400,  Reason:No index exists for this sort, try indexing by the sort fields.' },

	});
});
describe('cross chaincode', () => {
	// TODO
});
describe('chaincode query after content filled', () => {
	it('worldStates', async () => {
		const org = 'icdd';
		const queryResult = await diagnose.list(org);
		logger.info(queryResult);
	});
	it('tricky: chaincode ID from NameSpace', async () => {
		const queryResult = await diagnose.chaincodeID();
		assert.strictEqual(queryResult, 'diagnose');
	});
	it('pagination:from start: page size = 1', async () => {
		const queryResult = await diagnose.getPage();
		logger.info(queryResult);
	});
	it('pagination:from start: page size = 2', async () => {
		const queryResult = await diagnose.getPage(undefined, undefined, 2);
		logger.info(queryResult);
	});
	it('pagination:from start: page size = 1, consequence', async () => {
		const org = 'icdd';
		let queryResult = await diagnose.getPage(undefined, undefined, 2);
		const {MetaData: {Bookmark}} = JSON.parse(queryResult);

		logger.info('page 1', queryResult);
		queryResult = await diagnose.getPage(undefined, undefined, 2, Bookmark);
		logger.info('page 2', queryResult);
	});

	it('overPagination', async () => {
		const pageSize = 2000;
		const result = await diagnose.getPage(undefined, undefined, pageSize);
		logger.debug('overPagination: 1 of responses', result[0]);
	});

});

describe('private data ', () => {
	const transientMap = {
		a: 'b'
	};
	const transientMap4Query = {
		a: ''
	};

	it('putPrivate', async () => {

		await diagnose.putPrivate(transientMap);
	});
	it('putPrivate: partial endorse', async () => {

		let noErr;
		try {
			await diagnose.putPrivate(transientMap);
			noErr = true;
		} catch (e) {
			logger.info(e);
			assert.strictEqual(e.status, TxValidationCode['10'], 'expect endorsing error');
		}
		if (noErr) {
			assert.fail('expect endorsing error');
		}
	});
	it('getPrivate', async () => {

		const result = await diagnose.getPrivate(transientMap4Query);
		logger.info(result);
	});
	it('putImplicit, OK to have more endorsers than require', async () => {
		const result = await diagnose.putImplicit(transientMap);
		logger.info(getResponses(result));
	});

	it('putImplicit: not OK: org1 creator| org2 endorser | org1 implicit', async () => {
		let isSuccess;
		try {
			await diagnose.putImplicit(transientMap);
			isSuccess = true;
		} catch (e) {
			logger.info(e);
			assert.strictEqual(e.status, 'ENDORSEMENT_POLICY_FAILURE');
		}
		if (isSuccess) {
			assert.fail('expect endorsing error');
		}


	});
	it('putImplicit: OK, org1 creator| org2 endorser | org2 implicit', async () => {
		const result = await diagnose.putImplicit(transientMap, 'astriMSP');
		logger.info(getResponses(result));
	});

	it('getImplicit: Not OK: org1 implicit not found for org2 peer', async () => {
		let isSuccess;
		try {
			await diagnose.getImplicit(transientMap4Query);
			isSuccess = true;
		} catch (e) {
			logger.info(e.errors[0]);
		}
		if (isSuccess) {
			assert.fail('expect endorsing error');
		}
	});
	it('getImplicit: OK: org1 creator| org2 endorser | org2 implicit', async () => {
		const result = await diagnose.getImplicit(transientMap, 'astriMSP');
		logger.info(result);
	});

});
