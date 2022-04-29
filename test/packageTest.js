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
		it('pack golang: diy packer is required for external chaincode', async () => {

			const Path = homeResolve('Documents/chaincode/golang/diagnose');
			const Label = 'diagnose';
			const pack = new Package({Path, Label});
			const binOutput = Label + '.bin.ccPack.tar';
			const diyOutput = Label + '.diy.ccPack.tar';
			pack.pack(binOutput, binManager);
			pack.pack(diyOutput);
			const binID = pack.calculateID(binOutput, binManager);
			const diyID = pack.calculateID(diyOutput);
			console.debug({binID, diyID});
			// Even binID is related to userid, so it can be
			// db2c2e31fc6294c1d324b6303510ad38185527119af4a1d3bf576b05a2bad38c by npm test
			// CI
			assert.strictEqual(binID, Label + ':b3b9c7963a25754e6562d0be8c72f4b2dbdaca2203b82da36331a87cb4b2e0ea');
			assert.strictEqual(diyID, Label + ':d371ba2a7eb68548427b8b368314a62fd0aa3a934d0189752c143a22dad69ac9');

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
			const pack = new Package({Type: 'external', Label, Path});
			const packageID = pack.pack(outputFile, binManager);
			console.debug(packageID);
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