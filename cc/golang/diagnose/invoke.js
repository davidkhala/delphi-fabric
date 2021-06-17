const assert = require('assert');

const helper = require('../../../app/helper');
const {invoke, query} = require('../../../app/invokeHelper');
const {
	putRaw, getRaw, whoami, putBatch, list, get, put, chaincodeID, getEndorsement, putEndorsement, getPage, getCertID, peerMSPID,
	getPrivate, putPrivate, putImplicit, getImplicit, chaincodePing, richQuery
} = require('./diagnoseInvoke');

const {getResponses} = require('../../../common/nodejs/formatter/proposalResponse');
const chaincodeId = 'diagnose';
const logger = require('khala-logger/log4js').consoleLogger('chaincode:diagnose');
const {TxValidationCode} = require('../../../common/nodejs/formatter/constants');
const org1 = 'icdd';
const org2 = 'astri.org';
const peers = helper.allPeers();
describe('chaincode Initialize', () => {

	it('init', async () => {
		const org = 'icdd';
		await invoke(peers, org, chaincodeId, {
			init: true,
		});
	});
});
describe('chaincode query', () => {
	it('whom am i ', async () => {
		const org = 'icdd';
		const queryResult = await whoami(peers, org);
		logger.info(queryResult);
	});

	it('getCertID', async () => {
		const result = await getCertID(peers, org1);
		logger.info('certID', result);
	});
	it('peerMSPID', async () => {
		const result = await peerMSPID(peers, org1);
		logger.info(result);
	});
	it('chaincode ping (google.com)', async () => {
		const result = await chaincodePing(peers, org1);
		logger.info(result);
	});
});
describe('chaincode invoke', () => {
	it('put & get raw value', async () => {
		const org = 'icdd';
		const value = Date.now().toString();
		const key = 'a';
		await putRaw(peers, org, key, value);
		const queryResult = await getRaw(peers, org, key);
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

		await putBatch(peers, org1, map);
	});
	it('OverList: > 100', async () => {
		const map = batchMap(200);
		await putBatch(peers, org1, map);
		const worldStatesResults = await list(peers, org1);
		const worldStatesResult = JSON.parse(worldStatesResults[0]);
		logger.debug(worldStatesResult.length);
	});
	it('put and get:for couchdb index', async () => {
		const key = 'a';
		await put(peers, org1, key, 'b');
		const gotValue = await get(peers, org1, key);
		logger.debug('get response', gotValue[0]);
	});
	it('key-level endorsement: set to single', async () => {
		const endorseKey = 'a';
		await putEndorsement(peers, org1, endorseKey, ['icddMSP']);
		const endorsingOrgs = await getEndorsement(peers, org1, endorseKey);
		logger.info('endorsingOrgs', endorsingOrgs[0]);

		const updatedPeers = helper.newPeers([0], org1);
		await put(updatedPeers, org1, endorseKey, 'endorsing hack');
	});
	const singleEndorseShouldFail = async (endorseKey) => {
		const updatedPeers = helper.newPeers([0], org1);
		try {
			await put(updatedPeers, org1, endorseKey, 'endorsing hack');
			assert.fail('expect endorsing error');

		} catch (e) {
			logger.info('expect endorsing error', e);
			for (const peer of peers) {
				await peer.disconnect();
			}
		}
	};
	const multiEndorseShouldSuccess = async (endorseKey) => {
		const updatedPeers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
		await put(updatedPeers, org1, endorseKey, 'endorsing good');

	};
	it('key-level endorsement set correct', async () => {
		const endorseKey = 'a';
		await putEndorsement(peers, org1, endorseKey, ['astriMSP', 'icddMSP']);
		const endorsingOrgs = await getEndorsement(peers, org1, endorseKey);
		logger.info('endorsingOrgs', endorsingOrgs[0]);
		await singleEndorseShouldFail(endorseKey);
		await multiEndorseShouldSuccess(endorseKey);

	});
	it('key-level endorsement: delete', async () => {
		const endorseKey = 'a';
		await putEndorsement(peers, org1, endorseKey);
		const endorsingOrgs = await getEndorsement(peers, org1, endorseKey);
		logger.info('endorsingOrgs', endorsingOrgs[0]);
		await singleEndorseShouldFail(endorseKey);
		await multiEndorseShouldSuccess(endorseKey);
	});
});
describe('couchdb', () => {
	const peers = helper.allPeers(org2);
	const key = 'david';
	const value = 'khala';
	it('write', async () => {

		await put(peers, org1, key, value);
		// validate write
		const result = await get(peers, org1, key);
		console.debug(result);
	});
	const {base64} = require('khala-nodeutils/format');
	it('read', async () => {

		const results = await richQuery(peers, org1);
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
		const queryResult = await list(peers, org);
		logger.info(queryResult);
	});
	it('tricky: chaincode ID from NameSpace', async () => {
		const org = 'icdd';
		const queryResult = await chaincodeID(peers, org);
		logger.info(queryResult);
	});
	it('pagination:from start: page size = 1', async () => {
		const org = 'icdd';
		const queryResult = await getPage(peers, org);
		logger.info(queryResult);
	});
	it('pagination:from start: page size = 2', async () => {
		const org = 'icdd';
		const queryResult = await getPage(peers, org, undefined, undefined, 2);
		logger.info(queryResult);
	});
	it('pagination:from start: page size = 1, consequence', async () => {
		const org = 'icdd';
		let queryResult = await getPage(peers, org, undefined, undefined, 2);
		const Bookmarks = queryResult.map(json => {
			const {MetaData} = JSON.parse(json);
			return MetaData.Bookmark;
		});
		logger.info('page 1', queryResult);
		queryResult = await getPage(peers, org, undefined, undefined, 2, Bookmarks[0]);
		logger.info('page 2', queryResult);
	});

	it('overPagination', async () => {
		const pageSize = 2000;
		const result = await getPage(peers, org1, undefined, undefined, pageSize);
		logger.debug('overPagination: 1 of responses', result[0]);
	});

});
const {readWritePrivate} = require('./diagnoseInvoke');
describe('private data ', () => {
	const collectionPeers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const transientMap = {
		a: 'b'
	};
	const transientMap4Query = {
		a: ''
	};
	it('readWritePrivate ', async () => {
		await readWritePrivate(collectionPeers, org1, transientMap);
	});
	it('putPrivate', async () => {

		await putPrivate(collectionPeers, org1, transientMap);
	});
	it('putPrivate: partial endorse', async () => {
		const peers1 = [helper.newPeer(0, org1)];

		let noErr;
		try {
			await putPrivate(peers1, org1, transientMap);
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

		const result = await getPrivate(collectionPeers, org2, transientMap4Query);
		logger.info(result);
	});
	it('putImplicit, OK to have more endorsers than require', async () => {
		const result = await putImplicit(collectionPeers, org1, transientMap);
		logger.info(getResponses(result));
	});

	it('putImplicit: not OK: org1 creator| org2 endorser | org1 implicit', async () => {
		const org2Peers = helper.newPeers([0], org2);
		let isSuccess;
		try {
			await putImplicit(org2Peers, org1, transientMap);
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
		const org2Peers = helper.newPeers([0], org2);
		const result = await putImplicit(org2Peers, org1, transientMap, 'astriMSP');
		logger.info(getResponses(result));
	});

	it('getImplicit: Not OK: org1 implicit not found for org2 peer', async () => {
		let isSuccess;
		try {
			await getImplicit(collectionPeers, org1, transientMap4Query);
			isSuccess = true;
		} catch (e) {
			logger.info(e.errors[0]);
		}
		if (isSuccess) {
			assert.fail('expect endorsing error');
		}
	});
	it('getImplicit: OK: org1 creator| org2 endorser | org2 implicit', async () => {
		const org2Peers = helper.newPeers([0], org2);
		const result = await getImplicit(org2Peers, org1, transientMap, 'astriMSP');
		logger.info(result);
	});

});
