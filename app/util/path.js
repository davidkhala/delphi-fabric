const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');
const os = require('os');
exports.home = () => {
	return os.homedir();
};
exports.findKeyfiles = (dir) => {
	const files = fs.readdirSync(dir);
	return files.filter((fileName) => fileName.endsWith('_sk')).map((fileName) => path.resolve(dir, fileName));
};
exports.CryptoPath = class {
	constructor(rootPath, {orderer, peer, user, react} = {}) {
		if (orderer) {
			this.ordererOrgName = orderer.org;
			if (orderer.name && orderer.org) {
				this.ordererName = `${orderer.name}.${orderer.org}`;
			}
		}
		if (peer) {
			this.peerOrgName = peer.org;
			if (peer.name && peer.org) {
				this.peerName = `${peer.name}.${peer.org}`;
			}
		}
		if (user) {
			this.userName = user.name;
		}
		this.root = rootPath;
		this.react = react;
	}

	setReact(react) {
		this.react = react;
	}

	resolve(...tokens) {
		const result = path.resolve(...tokens);
		const dir = path.dirname(result);
		switch (this.react) {
		case 'throw':
			if (!fs.existsSync(dir)) {
				throw new Error(`${dir} not exist`);
			}
			break;
		case 'mkdir':
			fsExtra.ensureDirSync(result);
			break;
		default:
		}
		return result;
	}

	ordererOrg() {
		return this.resolve(this.root, 'ordererOrganizations', this.ordererOrgName);
	}

	peerOrg() {
		return this.resolve(this.root, 'peerOrganizations', this.peerOrgName);
	}

	orderers() {
		return this.resolve(this.ordererOrg(), 'orderers');
	}

	ordererUsers() {
		return this.resolve(this.ordererOrg(), 'users');
	}

	peers() {
		return this.resolve(this.peerOrg(), 'peers');
	}

	peerUsers() {
		return this.resolve(this.peerOrg(), 'users');
	}

	ordererMSP() {
		return this.resolve(this.orderers(), `${this.ordererName}.${this.ordererOrgName}`, 'msp');
	}

	ordererMSPSigncert() {
		return this.resolve(this.ordererMSP(), 'signcerts', `${this.ordererName}.${this.ordererOrgName}-cert.pem`);
	}

	peerMSP() {
		return this.resolve(this.peers(), `${this.peerName}.${this.peerOrgName}`, 'msp');
	}

	peerCacerts() {
		return this.resolve(this.peerOrg(), 'msp', 'cacerts', `ca.${this.peerOrgName}-cert.pem`);
	}

	ordererCacerts() {
		return this.resolve(this.ordererOrg(), 'msp', 'cacerts', `ca.${this.ordererOrgName}-cert.pem`);
	}

	peerMSPSigncert() {
		return this.resolve(this.peerMSP(), 'signcerts', `${this.peerName}.${this.peerOrgName}-cert.pem`);
	}

	ordererUserMSP() {
		return this.resolve(this.ordererUsers(), `${this.userName}@${this.ordererOrgName}`, 'msp');
	}

	ordererUserMSPSigncert() {
		return this.resolve(this.ordererUserMSP(), 'signcerts', `${this.userName}@${this.ordererOrgName}-cert.pem`);
	}

	peerUserMSP() {
		return this.resolve(this.peerUsers(), `${this.userName}@${this.peerOrgName}`, 'msp');
	}

	peerUserMSPSigncert() {
		return this.resolve(this.peerUserMSP(), 'signcerts', `${this.userName}@${this.peerOrgName}-cert.pem`);
	}
};