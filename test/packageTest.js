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
		it('pack golang: binManager donot match content to DIY packer', async () => {

			const Path = homeResolve('Documents/chaincode/golang/diagnose');
			const Label = 'diagnose';
			const output = Label + '.ccPack.tar';
			const pack = new Package({Path, Label});
			await pack.pack(output);
			const diyDigest = sha2_256(fs.readFileSync(output).toString());
			const output2 = Label + '.2.ccPack.tar';
			await pack.pack(output2, binManager);
			const binDigest = sha2_256(fs.readFileSync(output2).toString());
			assert.strictEqual(diyDigest, 'f968a3bba5d59723a577423c73335cd10ae84d567dce1ba2a07698ee8b1055f1');
			assert.strictEqual(binDigest, '125a788a3a1da9370809363375ca35334dad4878bad2b2e254860f84970bf241');

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
