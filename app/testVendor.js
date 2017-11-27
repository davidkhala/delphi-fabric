const Vendor = require('./vendorUtil')
const logger = require('./util/logger').new('test-vendor')
const argsReadProject = [ 'project', 'Blockchain Hyperledger Demonstration']
const proposal = require('./vendor.json').project
const first = () => {
	return Vendor.firstInstall({ orgName: 'BU' }).then(() => {
		logger.info('firstInstall BU')


		// return Vendor.instantiate({ orgName: 'BU', args: [JSON.stringify(proposal)] })
		return Vendor.firstInstall({ orgName: 'PM' })

	}).then(() => {
		logger.info('PM install')

		return Vendor.firstInstall({ orgName: 'ENG' })
	}).then(() => {
		logger.info('ENG install')

		return Vendor.instantiate({ orgName: 'BU', args: [JSON.stringify(proposal)] })
	}).then(() => {
		return Vendor.invoke({ orgName: 'ENG', args: argsReadProject ,fcn:'read'})
	})
}
const second = () => {
	return Vendor.invoke({ orgName: 'ENG', args: argsReadProject }).then(result => {
		logger.info(result)
	})
}
second()