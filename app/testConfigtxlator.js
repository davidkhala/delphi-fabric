// This test case requires that the 'configtxlator' tool be running locally and on port 7059
// fixme :run configtxlator.server with nodejs child_process, program will hang and no callback or stdout
// TODO not ready
const helper = require('./helper')
const logger = helper.getLogger('configtxlator')

const channelName = 'delphiChannel'

const api = require('./configtxlator')
const deleteOrg = (MSPName) => {

	return api.channelUpdate(channelName, ({ update_config }) => {
		return api.deleteMSP({ MSPName, update_config })
	})

}
const addOrg = (orgName, MSPName, MSPID, templateMSPName, adminMSPDir, org_domain) => {
	return api.channelUpdate(channelName, ({ update_config }) => {

		return api.cloneMSP({ MSPName, MSPID, update_config, templateMSPName, adminMSPDir, org_domain })
	}).catch(err => {
		logger.error(err)
	})

}
exports.addOrg = addOrg
exports.deleteOrg=deleteOrg






