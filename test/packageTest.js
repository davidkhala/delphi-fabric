import Package from '../common/nodejs/chaincodePackage.js';
import path from 'path';
import {sha2_256} from '../common/nodejs/formatter/helper.js';
import {homeResolve} from '@davidkhala/light/index.js';
import BinManager from '../common/nodejs/binManager.js';
import {filedirname} from '@davidkhala/light/es6.mjs';
import fs from 'fs';
import assert from 'assert';

filedirname(import.meta);
const binPath = path.resolve(__dirname, '../common/bin');
const binManager = new BinManager(binPath);
describe('package', function () {
		this.timeout(0);
		it('pack golang: binManager do not match content to DIY packer', async () => {

			const Path = homeResolve('Documents/chaincode/golang/diagnose');
			const Label = 'diagnose';
			const output = Label + '.diy.ccPack.tar';
			const pack = new Package({Path, Label});
			await pack.pack(output);
			const output2 = Label + '.bin.ccPack.tar';
			await pack.pack(output2, binManager);
			const diyID = pack.calculateId(output, binManager);
			const binID = pack.calculateId(output2, binManager);
			console.debug({diyID, binID});

		});

		it('pack nodejs', async () => {

			const Label = 'nodeDiagnose';
			const outputFile = Label + '.ccPackage.tar.gz';
			const Path = homeResolve('Documents/chaincode/nodejs/diagnose');
			const Type = 'node';
			const pack = new Package({Path, Type, Label});
			await pack.pack(outputFile);
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
			const connect = {address};
			await pack.pack(outputFile, undefined, connect);
		});
	}
)
;
