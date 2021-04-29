const helper = require('../../app/helper');
const {richQuery} = require('../../cc/golang/diagnose/diagnoseInvoke');
const logger = require('khala-logger/log4js').consoleLogger('test: rich query');
const assert = require('assert');
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
