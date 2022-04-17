import assert from 'assert';
import {base64} from '@davidkhala/light/format.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {
	DiagnoseInvoke
} from './diagnoseInvoke.js';
const diagnose = new DiagnoseInvoke()
import {getResponses} from '../../../common/nodejs/formatter/proposalResponse.js';
import {TxValidationCode} from '../../../common/nodejs/formatter/constants.js';


const logger = consoleLogger('chaincode:diagnose');
const org1 = 'icdd';
const org2 = 'astri.org';

describe('chaincode query', () => {
	it('whom am i ', async () => {
		const org = 'icdd';
		const queryResult = await whoami(org);
		logger.info(queryResult);
	});

	it('getCertID', async () => {
		const result = await getCertID(org1);
		logger.info('certID', result);
	});
	it('peerMSPID', async () => {
		const result = await peerMSPID(org1);
		logger.info(result);
	});
	it('chaincode ping (google.com)', async () => {
		const result = await chaincodePing(org1);
		logger.info(result);
	});
});
describe('chaincode invoke', function () {
	this.timeout(0)
	it('put & get raw value', async () => {
		const org = 'icdd';
		const value = Date.now().toString();
		const key = 'a';
		await putRaw(org, key, value);
		const queryResult = await getRaw(org, key);
		logger.info(queryResult);
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

		await putBatch(org1, map);
	});
	it('OverList: > 100', async () => {
		const map = batchMap(200);
		await putBatch(org1, map);
		const worldStatesResults = await list(org1);
		logger.debug(JSON.parse(worldStatesResults).length);
	});
	it('put and get:for couchdb index', async () => {
		const key = 'a';
		await put(org1, key, 'b');
		const gotValue = await get(org1, key);
		logger.debug('get response', gotValue[0]);
	});
	it('key-level endorsement: set to single', async () => {
		const endorseKey = 'a';
		await putEndorsement(org1, endorseKey, ['icddMSP']);
		const endorsingOrgs = await getEndorsement(org1, endorseKey);
		logger.info('endorsingOrgs', endorsingOrgs[0]);

		// TODO observe the behavior of endorsing hack
		await put(org1, endorseKey, 'endorsing hack');
	});
	const singleEndorseShouldFail = async (endorseKey) => {
		try {
			await put(org1, endorseKey, 'endorsing hack');
			assert.fail('expect endorsing error');

		} catch (e) {
			logger.info('expect endorsing error', e);
		}
	};
	const multiEndorseShouldSuccess = async (endorseKey) => {
		await put(org1, endorseKey, 'endorsing good');

	};
	it('key-level endorsement set correct', async () => {
		const endorseKey = 'a';
		await putEndorsement(org1, endorseKey, ['astriMSP', 'icddMSP']);
		const endorsingOrgs = await getEndorsement(org1, endorseKey);
		logger.info('endorsingOrgs', endorsingOrgs[0]);
		await singleEndorseShouldFail(endorseKey);
		await multiEndorseShouldSuccess(endorseKey);

	});
	it('key-level endorsement: delete', async () => {
		const endorseKey = 'a';
		await putEndorsement(org1, endorseKey);
		const endorsingOrgs = await getEndorsement(org1, endorseKey);
		logger.info('endorsingOrgs', endorsingOrgs[0]);
		await singleEndorseShouldFail(endorseKey);
		await multiEndorseShouldSuccess(endorseKey);
	});
});
describe('couchdb', () => {
	const key = 'david';
	const value = 'khala';
	it('write', async () => {

		await put(org1, key, value);
		// validate write
		const result = await get(org1, key);
		console.debug(result);
	});

	it('read', async () => {

		const results = await richQuery(org1);
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
		const queryResult = await list(org);
		logger.info(queryResult);
	});
	it('tricky: chaincode ID from NameSpace', async () => {
		const org = 'icdd';
		const queryResult = await chaincodeID(org);
		logger.info(queryResult);
	});
	it('pagination:from start: page size = 1', async () => {
		const org = 'icdd';
		const queryResult = await getPage(org);
		logger.info(queryResult);
	});
	it('pagination:from start: page size = 2', async () => {
		const org = 'icdd';
		const queryResult = await getPage(org, undefined, undefined, 2);
		logger.info(queryResult);
	});
	it('pagination:from start: page size = 1, consequence', async () => {
		const org = 'icdd';
		let queryResult = await getPage(org, undefined, undefined, 2);
		const {MetaData: {Bookmark}} = JSON.parse(queryResult);

		logger.info('page 1', queryResult);
		queryResult = await getPage(org, undefined, undefined, 2, Bookmark);
		logger.info('page 2', queryResult);
	});

	it('overPagination', async () => {
		const pageSize = 2000;
		const result = await getPage(org1, undefined, undefined, pageSize);
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
	it('readWritePrivate ', async () => {
		await readWritePrivate(org1, transientMap);
	});
	it('putPrivate', async () => {

		await putPrivate(org1, transientMap);
	});
	it('putPrivate: partial endorse', async () => {

		let noErr;
		try {
			await putPrivate(org1, transientMap);
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

		const result = await getPrivate(org2, transientMap4Query);
		logger.info(result);
	});
	it('putImplicit, OK to have more endorsers than require', async () => {
		const result = await putImplicit(org1, transientMap);
		logger.info(getResponses(result));
	});

	it('putImplicit: not OK: org1 creator| org2 endorser | org1 implicit', async () => {
		let isSuccess;
		try {
			await putImplicit(org1, transientMap);
			isSuccess = true;
		} catch (e) {
			logger.info(e);
			assert.equal(e.status, 'ENDORSEMENT_POLICY_FAILURE');
		}
		if (isSuccess) {
			assert.fail('expect endorsing error');
		}


	});
	it('putImplicit: OK, org1 creator| org2 endorser | org2 implicit', async () => {
		const result = await putImplicit(org1, transientMap, 'astriMSP');
		logger.info(getResponses(result));
	});

	it('getImplicit: Not OK: org1 implicit not found for org2 peer', async () => {
		let isSuccess;
		try {
			await getImplicit(org1, transientMap4Query);
			isSuccess = true;
		} catch (e) {
			logger.info(e.errors[0]);
		}
		if (isSuccess) {
			assert.fail('expect endorsing error');
		}
	});
	it('getImplicit: OK: org1 creator| org2 endorser | org2 implicit', async () => {
		const result = await getImplicit(org1, transientMap, 'astriMSP');
		logger.info(result);
	});

});
