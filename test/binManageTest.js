import path from 'path';
process.env.binPath = path.resolve(__dirname, '../common/bin');
import BinManager from '../common/nodejs/binManager.js';
import fsExtra from 'fs-extra';
import Package from '../common/nodejs/chaincodePackage.js';
import {homeResolve} from '@davidkhala/light/index.js';
const binManager = new BinManager();
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
