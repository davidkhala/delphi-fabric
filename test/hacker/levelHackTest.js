import {PeerLedger} from '../../common/nodejs/leveldb.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {organizations} from '../../config/orgs.json';
import {homeResolve} from '@davidkhala/light/index.js';

const logger = consoleLogger('test:peerLedger');
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
		this.timeout(0);
		const rawList = await stateLeveldb.list();
		logger.debug('stateLeveldb', rawList.filter(({key, value}) => PeerLedger.filter.stateLeveldb({
			key,
			value
		}, {channel: 'allchannel', chaincodeId: 'diagnose'})));
	});
});

