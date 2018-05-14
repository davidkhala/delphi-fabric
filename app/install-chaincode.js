//NOTE install chaincode does not require channel existence
const golangUtil = require('../common/nodejs/golang');
const dockerodeUtil = require('../common/nodejs/fabric-dockerode');
const chaincodeUtil = require('../common/nodejs/chaincode');
const logUtil = require('../common/nodejs/logger');

//allowedCharsChaincodeName = "[A-Za-z0-9_-]+"
// allowedCharsVersion       = "[A-Za-z0-9_.-]+"
//

exports.install = async (peers, {chaincodeId, chaincodePath, chaincodeVersion}, client) => {
	const logger = logUtil.new('install-chaincode');
	logger.debug({peers_length: peers.length, chaincodeId, chaincodePath, chaincodeVersion});

	const request = {
		targets: peers,
		chaincodePath,
		chaincodeId,
		chaincodeVersion
	};
	await golangUtil.setGOPATH();
	const [responses, proposal, header] = await client.installChaincode(request);
	const ccHandler = chaincodeUtil.chaincodeProposalAdapter('install', (proposalResponse) => {
		const {response} = proposalResponse;
		if (response && response.status === 200) return {
			isValid: true,
			isSwallowed: false
		};
		if (proposalResponse instanceof Error && proposalResponse.toString().includes('exists')) {
			logger.warn('swallow when exsitence');
			return {isValid: true, isSwallowed: true};
		}
		return {isValid: false, isSwallowed: false};
	});
	const result = ccHandler([responses, proposal, header]);
	const {errCounter, nextRequest: {proposalResponses}} = result;
	if (errCounter > 0) {
		throw proposalResponses;
	} else {
		return result;
	}
};

exports.updateInstall = (peers, {chaincodeId}, client) => {
	const Query = require('../common/nodejs/query');

	return Query.chaincodes.installed(peers[0], client).then(({chaincodes}) => {
		const foundChaincode = chaincodes.find((element) => element.name === chaincodeId);
		if (!foundChaincode) {
			return Promise.reject(`No chaincode found with name ${chaincodeId}`);
		}
		const {version, path: chaincodePath} = foundChaincode;

		// [ { name: 'adminChaincode',
		// 	version: 'v0',
		// 	path: 'github.com/admin',
		// 	input: '',
		// 	escc: '',
		// 	vscc: '' } ]

		const chaincodeVersion = chaincodeUtil.nextVersion(version);
		return module.exports.install(peers, {chaincodeId, chaincodePath, chaincodeVersion}, client);
	});

};
//FIXME not ready, will lead to failure of  cannot retrieve package for chaincode adminChaincode/v0, error open /var/hyperledger/production/chaincodes/adminChaincode.v0: no such file or directory
//TODO: not working in swarm mode
exports.uninstall = (richPeers, {chaincodeId, chaincodeVersion}) => {
	const logger = logUtil.new('uninstall-chaincode');

	const promises = [];
	for (let peer of richPeers) {
		const {container_name} = peer.peerConfig;
		logger.debug(container_name);
		promises.push(dockerodeUtil.uninstallChaincode({container_name, chaincodeId, chaincodeVersion}));
	}
	return Promise.all(promises);

};
