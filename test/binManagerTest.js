const path = require('path');
const Golang = require('../common/nodejs/golang');
const BinManager = require('../common/nodejs/binManager');
const binManager = new BinManager(path.resolve(__dirname, '../common/bin/'));
const {homeResolve} = require('khala-nodeutils/helper');
describe('binManager', () => {
	it('chaincode Package:golang', () => {
		const chaincodeId = 'diagnose';
		const chaincodePath = 'github.com/davidkhala/chaincode/golang/diagnose';
		const localMspId = 'ASTRIMSP';
		const mspConfigPath = homeResolve('Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/peers/peer2.astri.org/msp');
		const chaincodeVersion = '0.0.0';
		const instantiatePolicy = '"AND(\'icddMSP.member\')"';
		const outputFile = `${chaincodeId}-${chaincodeVersion}.chaincodePack`;
		binManager.peer().package({chaincodeId, chaincodePath, chaincodeVersion}, {
			localMspId,
			mspConfigPath
		}, outputFile, instantiatePolicy);
	});
	it('chaincode package: nodejs', () => {
		const chaincodeId = 'nodeDiagnose';
		const chaincodePath = 'github.com/davidkhala/chaincode/nodejs/diagnose';
		const absolutePath = path.resolve(Golang.getGOPATH(), 'src', chaincodePath);
		const localMspId = 'ASTRIMSP';
		const mspConfigPath = homeResolve('Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/peers/peer2.astri.org/msp');
		const chaincodeVersion = '0.0.0';
		const instantiatePolicy = '"AND(\'icddMSP.member\')"';
		const chaincodeType = 'node';
		const outputFile = `${chaincodeId}-${chaincodeType}-${chaincodeVersion}.chaincodePack`;
		binManager.peer().package({
			chaincodeId,
			chaincodePath: absolutePath,
			chaincodeVersion, chaincodeType
		}, {
			localMspId,
			mspConfigPath
		}, outputFile, instantiatePolicy);
	});
	it('Signconfigtx', async () => {
		const localMspId = 'ASTRIMSP';
		const mspConfigPath = homeResolve('Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/peers/peer2.astri.org/msp');
		const configtxUpdateFile = homeResolve('Documents/delphi-fabric/config/configtx/all.tx');
		await binManager.peer().signconfigtx(configtxUpdateFile, localMspId, mspConfigPath);
	});
});

