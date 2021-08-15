const Package = require('../common/nodejs/chaincodePackage');
const path = require('path');
describe('package', () => {
	const {homeResolve} = require('khala-light-util');
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
	const BinManager = require('../common/nodejs/binManager');
	const binPath = path.resolve(__dirname, '../common/bin');
	const binManager = new BinManager(binPath);
	it('pack golang:binManager', async function () {
		this.timeout(0);
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
});
