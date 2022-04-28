import Package from '../common/nodejs/chaincodePackage.js';
import path from 'path';

import {homeResolve} from '@davidkhala/light/index.js';
import BinManager from '../common/nodejs/binManager.js';
import {filedirname} from '@davidkhala/light/es6.mjs';
import fs from 'fs';
import assert from 'assert';
import {sha2_256} from '../common/nodejs/formatter/helper.js';

filedirname(import.meta);
const binPath = path.resolve(__dirname, '../common/bin');
const binManager = new BinManager(binPath);
describe('package', function () {
		this.timeout(0);
		it('pack golang: no DIY packer yet', async () => {

			const Path = homeResolve('Documents/chaincode/golang/diagnose');
			const Label = 'diagnose';
			const pack = new Package({Path, Label});
			const output2 = Label + '.bin.ccPack.tar';
			await pack.pack(output2, binManager);
			const binID = pack.calculateID(output2, binManager);
			console.debug({binID});

		});

		it('pack nodejs', async () => {

			const Label = 'nodeDiagnose';
			const outputFile = Label + '.ccPackage.tar.gz';
			const Path = homeResolve('Documents/chaincode/nodejs/diagnose');
			const Type = 'node';
			const pack = new Package({Path, Type, Label});
			await pack.pack(outputFile, binManager);
		});


		it('pack golang:binManager', async () => {
			const Path = homeResolve('Documents/chaincode/golang/diagnose');
			const Label = 'diagnose';
			const output = Label + '.ccPack.tar';
			const pack = new Package({Path, Label});
			await pack.pack(output, binManager);
		});
		it('pack nodejs:binManager', async () => {

			const Label = 'nodeDiagnose';
			const outputFile = Label + '.ccPackage.tar.gz';
			const Path = homeResolve('Documents/chaincode/nodejs/diagnose');
			const Type = 'node';
			const pack = new Package({Path, Type, Label});
			await pack.pack(outputFile, binManager);
		});
		it('pack external', async () => {
			const Label = 'external';
			const outputFile = Label + '.ccPackage.tar.gz';
			const Path = homeResolve('Documents/chaincode/golang/external');
			const pack = new Package({Path, Label});
			await pack.pack(outputFile, binManager);
		});
	}
);
describe('package id', function () {
	this.timeout(0);

	it('binManager or no should be the same', async () => {
		const chaincodeId = 'diagnose';
		const outputFile = chaincodeId + '.ccPackage.tar.gz';
		const chaincodePackage = new Package({
			Path: homeResolve('Documents/chaincode/golang/diagnose'),
			Label: chaincodeId,
		});
		chaincodePackage.pack(outputFile, binManager);
		const packageID = chaincodePackage.calculateID(outputFile, binManager);
		assert.strictEqual(packageID, chaincodePackage.calculateID(outputFile));
		assert.strictEqual(packageID, chaincodePackage.calculateID(outputFile, undefined, true));
		const digest = sha2_256(fs.readFileSync(outputFile));

		assert.ok(packageID.endsWith(digest));
		fs.unlinkSync(outputFile);
	});
});