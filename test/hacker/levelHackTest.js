const {PeerLedger} = require('../../common/nodejs/leveldb');
const logger = require('khala-logger/log4js').consoleLogger('test:peerLedger');
const {organizations} = require('../../config/orgs.json');
const {homeResolve} = require('khala-light-util');
describe('peerLedger', () => {
	const rootPath = homeResolve(organizations.icdd.peers[0].stateVolume);
	const peerLedger = new PeerLedger(rootPath);
	logger.debug(peerLedger.statePath.chaincodes());
	const {stateLeveldb} = peerLedger.statePath.ledgersData;
	beforeEach(async () => {
		await stateLeveldb.connect();
	});
	afterEach(async () => {
		await stateLeveldb.disconnect();
	});
	it('ledgersData', async function () {
		this.timeout(30000);
		const rawList = await stateLeveldb.list();
		logger.debug('stateLeveldb', rawList.filter(({key, value}) => PeerLedger.filter.stateLeveldb({
			key,
			value
		}, {channel: 'allchannel', chaincodeId: 'diagnose'})));
	});
});

