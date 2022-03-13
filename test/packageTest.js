import Package from '../common/nodejs/chaincodePackage.js';
import path from 'path';
import {homeResolve} from '@davidkhala/light/index.js';
import BinManager from '../common/nodejs/binManager.js';
import {filedirname} from '@davidkhala/light/es6.mjs';

filedirname(import.meta);
const binPath = path.resolve(__dirname, '../common/bin');
const binManager = new BinManager(binPath);
describe('package', function () {
		this.timeout(0);
		it('pack golang', async () => {

			const Path = homeResolve('Documents/chaincode/golang/diagnose');
			const Label = 'diagnose';
			const output = Label + '.ccPack.tar';
			const pack = new Package({Path, Label});
			await pack.pack(output);

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
	}
)
;
