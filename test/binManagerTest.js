const path = require('path');
const BinManager = require('../common/nodejs/binManager');
const binManager = new BinManager(path.resolve(__dirname, '../common/bin/'));
const {homeResolve} = require('khala-nodeutils/helper');
const taskChaincodePackage = async () => {
	const chaincodeId = 'diagnose';
	const chaincodePath = 'github.com/davidkhala/chaincode/golang/diagnose';
	const localMspId = 'ASTRIMSP';
	const mspConfigPath = homeResolve('Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/peers/peer2.astri.org/msp');
	const chaincodeVersion = '0.0.0';
	const instantiatePolicy = '"AND(\'icddMSP.member\')"';
	const outputFile = `${chaincodeId}-${chaincodeVersion}.chaincodePack`;
	await binManager.peer().package({chaincodeId, chaincodePath, chaincodeVersion}, {
		localMspId,
		mspConfigPath
	}, outputFile, instantiatePolicy);
};
const task = async () => {

	switch (parseInt(process.env.taskID)) {
		default:
			await taskChaincodePackage();
	}

};
task();

