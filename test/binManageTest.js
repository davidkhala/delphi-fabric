const path = require('path');
process.env.binPath = path.resolve(__dirname, '../common/bin');
const BinManager = require('../common/nodejs/binManager');
const fsExtra = require('fs-extra');
const binManager = new BinManager();
fsExtra.ensureDirSync(path.resolve(__dirname, 'artifacts'));

describe('lifeCycle', () => {
	const {homeResolve} = require('khala-light-util');
	it('package', async () => {
		const chaincodeId = 'nodeDiagnose';
		const outputFile = chaincodeId + '.ccPackage.tar.gz';
		await binManager.peer().lifecycle.package({
			Type: 'node',
			Path: homeResolve('Documents/chaincode/nodejs/diagnose'),
			Label: chaincodeId,
		}, outputFile);
	});
});
