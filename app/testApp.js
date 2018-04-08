const logger = require('./util/logger').new('testAPP');

const requestPromise = require('request-promise-native');
const channelName = 'delphiChannel';
const testQuery = {
	channelJoined: () => {
		requestPromise({
			method: 'POST',
			uri: 'http://localhost:4000/query/channelJoined',
			body: {
				orgName: 'BU', peerIndex: 0
			},
			json: true
		}).then(result => {
			logger.debug(result);
		});
	},
	chaincodeInstantiate: () => {
		requestPromise({
			method: 'POST',
			uri: 'http://localhost:4000/query/chaincodes/instantiated',
			body: {
				orgName: 'BU', peerIndex: 0
				, channelName
			},
			json: true
		}).then(result => {
			logger.debug(result);
		});
	},
	chaincodeInstalled: () => {
		requestPromise({
			method: 'POST',
			uri: 'http://localhost:4000/query/chaincodes/installed',
			body: {
				orgName: 'BU', peerIndex: 0
			},
			json: true
		}).then(result => {
			logger.debug(result);
		});
	},
	chainHeight: () => {
		requestPromise({
			method: 'POST',
			uri: 'http://localhost:4000/query/chain',
			body: {
				orgName: 'BU', peerIndex: 0
				, channelName
			},
			json: true
		}).then(result => {
			logger.debug(result);
			const { pretty: { currentBlockHash ,height} } = result;
			return testQuery.blockByHash(currentBlockHash).then(() => {
				logger.debug('--todo query by height');
				return testQuery.blockByHeight(height-1);
			});
		});
	},
	blockByHeight: (height) => {
		requestPromise({
			method: 'POST',
			uri: `http://localhost:4000/query/block/height/${height}`,
			body: {
				orgName: 'BU', peerIndex: 0
				, channelName
			},
			json: true
		}).then(result => {
			logger.debug(result);
			return Promise.resolve(result);
		});
	},
	blockByHash: (hashHex) => {
		return requestPromise({
			method: 'POST',
			uri: 'http://localhost:4000/query/block/hash',
			body: {
				hashHex,
				orgName: 'BU', peerIndex: 0
				, channelName
			},
			json: true
		}).then(result => {
			logger.debug(result);
			return Promise.resolve(result);
		});
	}
};


testQuery.chaincodeInstalled();
testQuery.chaincodeInstantiate();
testQuery.channelJoined();
testQuery.chainHeight();

const testSwarmServer = ()=>{
	requestPromise({
		method: 'POST',
		uri: 'http://localhost:4001/leader/update',
		body: {
			ip:'123', hostname:'232', managerToken:'123'
		},
		json: true
	}).then(result => {
		logger.debug(result);
	});

	requestPromise({
		method: 'POST',
		uri: 'http://localhost:4001/manager/join',
		body: {
			ip:'123', hostname:'232',
		},
		json: true
	}).then(result => {
		logger.debug(result);
	});

	requestPromise({
		method: 'POST',
		uri: 'http://localhost:4001/manager/leave',
		body: {
			hostname:'232',
		},
		json: true
	}).then(result => {
		logger.debug(result);
	});
};

testSwarmServer();
