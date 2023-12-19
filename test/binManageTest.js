import path from 'path';
import fsExtra from 'fs-extra';
import {filedirname} from '@davidkhala/light/es6.mjs';
import {homeResolve} from '@davidkhala/light/path.js';
import {lifecycle as Lifecycle} from '../common/nodejs/binManager/peer.js';
import Package from '../common/nodejs/chaincodePackage.js';
import assert from 'assert';

filedirname(import.meta);
const lifecycle = new Lifecycle(path.resolve(__dirname, '../common/bin'));
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
		chaincodePackage.pack(outputFile, lifecycle);
		fsExtra.unlinkSync(outputFile);
	});

	it('package: diagnose', async () => {
		const chaincodeId = 'diagnose';
		const outputFile = chaincodeId + '.ccPackage.tar.gz';
		const chaincodePackage = new Package({
			Path: homeResolve('chaincode/golang/diagnose'),
			Label: chaincodeId,
		});
		chaincodePackage.pack(outputFile, lifecycle);

		fsExtra.unlinkSync(outputFile);
	});

});
