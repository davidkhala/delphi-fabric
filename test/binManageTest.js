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
			Path: homeResolve('Documents/chaincode/nodejs/diagnose'),
			Label: chaincodeId,
		});
		await chaincodePackage.pack(outputFile, binManager);
		const packageID = chaincodePackage.calculateId(outputFile, binManager);

		console.debug(packageID);
		fsExtra.unlinkSync(outputFile);
	});

	it('package: diagnose', async () => {
		const chaincodeId = 'diagnose';
		const outputFile = chaincodeId + '.ccPackage.tar.gz';
		const chaincodePackage = new Package({
			Type: 'golang',
			Path: homeResolve('Documents/chaincode/golang/diagnose'),
			Label: chaincodeId,
		});
		await chaincodePackage.pack(outputFile, binManager);
		const packageID = chaincodePackage.calculateId(outputFile, binManager);

		assert.strictEqual(packageID, 'diagnose:db2c2e31fc6294c1d324b6303510ad38185527119af4a1d3bf576b05a2bad38c')
		fsExtra.unlinkSync(outputFile);
	});
});
