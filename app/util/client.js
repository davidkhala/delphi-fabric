const BaseClient = require('fabric-client/lib/BaseClient');
const Utils = require('fabric-client/lib/utils');
const Client = require('fabric-client');
const path = require('path');

//TODO move to config
const cryptoKeyStorePath = path.join(path.dirname(__dirname), 'cryptoKeyStore');

exports.new = () => {
	const client = new Client();
	const newCryptoSuite = module.exports.newCryptoSuite({path:cryptoKeyStorePath});
	client.setCryptoSuite(newCryptoSuite);
	return client;
};
exports.newCryptoSuite  = ({path} = {path: Utils.getDefaultKeyStorePath()})=>{
	const newCryptoSuite = BaseClient.newCryptoSuite();
	newCryptoSuite.setCryptoKeyStore(BaseClient.newCryptoKeyStore(undefined, {path}));
	return newCryptoSuite;
};