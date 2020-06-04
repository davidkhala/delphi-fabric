const helper = require('../../app/helper');
const {richQuery} = require('../../cc/golang/diagnose/diagnoseInvoke');
const logger = require('khala-logger/log4js').consoleLogger('test: rich query');
const should = require('chai').should();
describe('rich query', () => {
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	it('error: query on level', async () => {
		try {
			await richQuery(peers, org1);
			should.fail('expect an error "ExecuteQuery not supported for leveldb"');
		} catch (err) {
			err.errors[0].response.message.should.match(/^GET_QUERY_RESULT failed: transaction ID: \w+: ExecuteQuery not supported for leveldb$/);
			err.message.should.equal('ENDORSE_ERROR');
		}


	});


});
