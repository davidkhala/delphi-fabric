import path from 'path';
import fsExtra from 'fs-extra';
import {filedirname} from '@davidkhala/light/es6.mjs';
import {homeResolve} from '@davidkhala/light/index.js';
import BinManager from '../common/nodejs/binManager.js';
import Package from '../common/nodejs/chaincodePackage.js';

filedirname(import.meta);
const binManager = new BinManager(path.resolve(__dirname, '../common/bin'));
fsExtra.ensureDirSync(path.resolve(__dirname, 'artifacts'));
describe('lifeCycle', () => {

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
