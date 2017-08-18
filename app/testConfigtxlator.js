// This test case requires that the 'configtxlator' tool be running locally and on port 7059

// TODO not ready
const path = require('path')
const fs = require('fs')
const cmd = require('./cmd_promise')
const CONFIGTXLATOR_FILE = path.join(__dirname, '../common/bin/configtxlator')
const helper = require('./helper')
const logger = helper.getLogger('configtxlator')
const client=helper.getClient()

const mychannelator_json = fs.readFileSync(
		path.join(__dirname, '../fabric-sdk-node/test/fixtures/channel/mychannelator.json'))
cmd.execFile(CONFIGTXLATOR_FILE).then(({ stdout, stderr }) => {
	console.log(stdout)
	console.error(stderr)

}).catch(({ err }) => {
	console.error(err)
})

const superagent = require('superagent')
const agent = require('superagent-promise')(superagent, Promise)

new Promise((resolve,reject) => {

	resolve(agent.post('http://127.0.0.1:7059/protolator/encode/common.ConfigUpdate', mychannelator_json.toString()).buffer())
}).then((config) =>{
	config_proto = config.body;
	logger.info('Successfully built the config create from the json input');

	// sign the config
	const signature = client.signChannelConfig(config_proto);
	logger.info('Successfully signed config create by org1');
	// // collect signature
	// signatures.push(signature);
	//
	// // make sure we do not reuse the user
	// client._userContext = null;
	//
	// return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org2');
}).catch(err=>{
	console.error(err)
})

