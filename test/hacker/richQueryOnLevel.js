import * as helper from '../../app/helper.js';
import {richQuery} from '../../cc/golang/diagnose/diagnoseInvoke.js';
import assert from 'assert';
import {consoleLogger} from '@davidkhala/logger/log4.js';

const logger = consoleLogger('test: rich query');
describe('rich query', () => {
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	it('error: query on level', async () => {
		try {
			await richQuery(peers, org1);
			logger.error('expect an error "ExecuteQuery not supported for leveldb"');
			process.exit(1);

		} catch (err) {
			assert.match(err.errors[0].response.message, /^GET_QUERY_RESULT failed: transaction ID: \w+: ExecuteQuery not supported for leveldb$/);
			assert.strictEqual(err.message, 'ENDORSE_ERROR');
		}
	});


});
