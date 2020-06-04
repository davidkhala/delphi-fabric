const {assert} = require('chai');

const helper = require('../../../../app/helper');
const {invoke} = require('../../../../app/invokeHelper');
const {putRaw, getRaw, whoami, putBatch, list, get, put, chaincodeID, getEndorsement, putEndorsement, getPage, getCertID, getPrivate, putPrivate} = require('../diagnoseInvoke');
const chaincodeId = 'diagnose';
const logger = require('khala-logger/log4js').consoleLogger('chaincode:diagnose');
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
describe('cross chaincode', () => {

});
describe('chaincode query after content filled', () => {
	it('worldStates', async () => {
		const org = 'icdd';
		const queryResult = await list(peers, org);
		logger.info(queryResult);
	});
	it('tricky: chaincode ID fron NameSpace', async () => {
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
const {readWritePrivate} = require('../diagnoseInvoke');
describe('private data ', () => {
	const collectionPeers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];

	it('readWritePrivate ', async () => {
		const transientMap = {
			a: 'b'
		};
		await readWritePrivate(collectionPeers, org1, transientMap);
	});
	it('putPrivate', async () => {
		const transientMap = {
			a: 'b'
		};
		await putPrivate(collectionPeers, org1, transientMap);
	});
	it('getPrivate', async () => {
		const transientMap = {
			a: ''
		};
		const result = await getPrivate(collectionPeers, org2, transientMap);
		console.info(result);
	});
});