const path = require('path');
process.env.binPath = path.resolve(__dirname, '../common/bin');
const BinManager = require('../common/nodejs/binManager');
const fsExtra = require('fs-extra');
const binManager = new BinManager();
fsExtra.ensureDirSync(path.resolve(__dirname, 'artifacts'));
const Package = require('../common/nodejs/chaincodePackage');
describe('lifeCycle', () => {
	const {homeResolve} = require('khala-light-util');
	const chaincodeId = 'nodeDiagnose';
	const outputFile = chaincodeId + '.ccPackage.tar.gz';
	it('package', async () => {

		const chaincodePackage = new Package({
			Type: 'node',
			Path: homeResolve('Documents/chaincode/nodejs/diagnose'),
			Label: chaincodeId,
		});
		await chaincodePackage.pack(outputFile, binManager);
	});
	after(() => {
		fsExtra.unlinkSync(outputFile);
	});
});
