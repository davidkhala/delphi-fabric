import path from 'path';
import fsExtra from 'fs-extra';
import {filedirname} from '@davidkhala/light/es6.mjs';
import {homeResolve} from '@davidkhala/light/index.js';
import BinManager from '../common/nodejs/binManager.js';
import Package from '../common/nodejs/chaincodePackage.js';
import assert from 'assert';
filedirname(import.meta);
const binManager = new BinManager(path.resolve(__dirname, '../common/bin'));
fsExtra.ensureDirSync(path.resolve(__dirname, 'artifacts'));
describe('lifeCycle', () => {


	it('package: nodeDiagnose', async () => {
		const chaincodeId = 'nodeDiagnose';
		const outputFile = chaincodeId + '.ccPackage.tar.gz';
		const chaincodePackage = new Package({
			Type: 'node',
			Path: homeResolve('chaincode/nodejs/diagnose'),
			Label: chaincodeId,
		});
		await chaincodePackage.pack(outputFile, binManager);
		const packageID = chaincodePackage.calculateID(outputFile, binManager);

		console.debug(packageID);
		fsExtra.unlinkSync(outputFile);
	});

	it('package: diagnose', async () => {
		const chaincodeId = 'diagnose';
		const outputFile = chaincodeId + '.ccPackage.tar.gz';
		const chaincodePackage = new Package({
			Path: homeResolve('chaincode/golang/diagnose'),
			Label: chaincodeId,
		});
		chaincodePackage.pack(outputFile, binManager);
		const packageID = chaincodePackage.calculateID(outputFile, binManager);

		assert.strictEqual(packageID, 'diagnose:b3b9c7963a25754e6562d0be8c72f4b2dbdaca2203b82da36331a87cb4b2e0ea');
		fsExtra.unlinkSync(outputFile);
	});

});
