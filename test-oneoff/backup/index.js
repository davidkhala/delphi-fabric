import DockerManager from '@davidkhala/dockerode/docker.js';
import {runPeer} from '../../common/nodejs/fabric-dockerode.js';

import {homeResolve} from '@davidkhala/light/path.js';
import {importFrom} from '@davidkhala/light/es6.mjs';

import peerUtil from '../../common/nodejs/peer.js';
import {CryptoPath} from '../../common/nodejs/path.js';
const globalConfig = importFrom(import.meta, '../../config/orgs.json');

const {TLS} = globalConfig;
const docker = new DockerManager();

export const stopPeer = async (org, peerIndex) => {
	const peerName = globalConfig.organizations[org].peers[peerIndex].container_name;
	await docker.containerDelete(peerName);
};
export const resumePeer = async (org, peerIndex) => {


	const {docker: {network, fabricTag: imageTag}} = globalConfig;
	const orgsConfig = globalConfig.organizations;

	const domain = org;
	const orgConfig = orgsConfig[domain];
	const peersConfig = orgConfig.peers;


	const {mspid} = orgConfig;
	const peerConfig = peersConfig[peerIndex];
	const {container_name, port, couchDB} = peerConfig;

	let {stateVolume} = peerConfig;
	if (stateVolume) {
		stateVolume = homeResolve(stateVolume);
	}

	const cryptoPath = new CryptoPath(peerUtil.container.MSPROOT, {
		peer: {
			org: domain, name: `peer${peerIndex}`
		}
	});
	const {peerHostName} = cryptoPath;

	const cryptoType = 'peer';
	const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;

	const type = 'peer';
	const configPath = cryptoPath.MSP(type);

	await runPeer({
		container_name, port, imageTag, network,
		peerHostName, tls,
		msp: {
			id: mspid,
			volumeName: 'MSPROOT',
			configPath
		}, couchDB, stateVolume
	});
};
