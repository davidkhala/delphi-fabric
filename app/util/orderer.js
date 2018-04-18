exports.find = ({orderers,ordererUrl})=>{
	return ordererUrl ? orderers.find((orderer) =>orderer.getUrl() === ordererUrl) : orderers[0];
};
const Orderer = require('fabric-client/lib/Orderer');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const pathUtil = require('./path');
exports.new = ({ordererPort, tls_cacerts, pem, orderer_hostName_full, host}) => {
	const Host = host ? host : 'localhost';
	let orderer_url = `grpcs://${Host}:${ordererPort}`;
	if(!pem){
		if(fs.existsSync(tls_cacerts)){
			pem = fs.readFileSync(tls_cacerts).toString();
		}
	}
	if (pem) {
		//tls enabled
		const orderer = new Orderer(orderer_url, {
			pem,
			'ssl-target-name-override': orderer_hostName_full
		});
		orderer.pem = pem;
		return orderer;
	} else {
		//tls disaled
		orderer_url = `grpc://${Host}:${ordererPort}`;
		return new Orderer(orderer_url);
	}

};
exports.cryptoExistLocal = (ordererMspRoot,{orderer_hostName_full})=>{
	fsExtra.ensureDirSync(ordererMspRoot);

	const keystoreDir = path.resolve(ordererMspRoot, 'keystore');
	const signcertsDir = path.resolve(ordererMspRoot, 'signcerts');

	const fileName = `${orderer_hostName_full}-cert.pem`;
	const signcertFile = path.resolve(signcertsDir, fileName);

	if (!fs.existsSync(keystoreDir)) return;
	const keyFile = pathUtil.findKeyfiles(keystoreDir)[0];

	if (!fs.existsSync(keyFile)) return;
	if (!fs.existsSync(signcertFile)) return;
	return {signcertFile};
}
exports.loadFromLocal= (ordererMspRoot, {orderer_hostName_full, ordererPort}) => {
	const isExist = module.exports.cryptoExistLocal(ordererMspRoot,{orderer_hostName_full});

	if(isExist){
		const {signcertFile} = isExist;
		return module.exports.new({ordererPort, tls_cacerts: signcertFile, orderer_hostName_full});
	}
	return false;
};