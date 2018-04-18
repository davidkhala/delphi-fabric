const Peer = require('fabric-client/lib/Peer');
const fs = require('fs-extra');
exports.new = ({peerPort, tls_cacerts, pem, peer_hostName_full, host}) => {
	const Host = host ? host : 'localhost';
	let peerUrl = `grpcs://${Host}:${peerPort}`;
	if (!pem) {
		if (fs.existsSync(tls_cacerts)) {
			pem = fs.readFileSync(tls_cacerts).toString();
		}
	}
	if (pem) {
		//tls enabled
		const peer = new Peer(peerUrl, {
			pem,
			'ssl-target-name-override': peer_hostName_full
		});
		peer.pem = pem;
		return peer;
	} else {
		//tls disaled
		peerUrl = `grpc://${Host}:${peerPort}`;
		return new Peer(peerUrl);
	}
};
const fsExtra = require('fs-extra');
const path = require('path');
const pathUtil = require('./path');
exports.cryptoExistLocal = (peerMspRoot, {peer_hostName_full})=>{
	fsExtra.ensureDirSync(peerMspRoot);

	const keystoreDir = path.resolve(peerMspRoot, 'keystore');
	const signcertsDir = path.resolve(peerMspRoot, 'signcerts');

	const fileName = `${peer_hostName_full}-cert.pem`;
	const signcertFile = path.resolve(signcertsDir, fileName);

	if (!fs.existsSync(keystoreDir)) return;
	const keyFile = pathUtil.findKeyfiles(keystoreDir)[0];

	if (!fs.existsSync(keyFile)) return;
	if (!fs.existsSync(signcertFile)) return;
	return {signcertFile};
}
exports.loadFromLocal = (peerMspRoot, {peer_hostName_full, peerPort}) => {
	const exist = module.exports.cryptoExistLocal(peerMspRoot,{peer_hostName_full});
	if(exist){
		const {signcertFile} = exist;
		return module.exports.new({peerPort, tls_cacerts: signcertFile, peer_hostName_full});
	}

};
exports.formatPeerName = (peerName, domain) => `${peerName}.${domain}`;
