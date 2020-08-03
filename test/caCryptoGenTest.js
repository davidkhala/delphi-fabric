const caCryptoGen = require('../common/nodejs/ca-crypto-gen');
const {ECDSA_Key} = require('../common/nodejs/formatter/key');
const fsExtra = require('fs-extra');
const CaCryptoGen = require('../nodePkg/caCryptoGen');
const globalConfig = require('../config/orgs.json');
const {getCaService, genUser} = new CaCryptoGen(globalConfig);
const Context = require('../nodePkg/index');
const path = require('path');
const logger = require('khala-logger/log4js').consoleLogger('test:caCryptoGen');
const should = require('chai').should();
const context = new Context(globalConfig);
describe('caCryptoGen', () => {
	let caService, domain, admin;

	beforeEach(async () => {
		domain = 'icdd';
		caService = await getCaService(8054, domain);
		admin = context.getUser('Admin', domain);
	});

	it('genClientKeyPair', async () => {
		const {key, certificate} = await caCryptoGen.genClientKeyPair(caService, {
			enrollmentID: `${domain}.client`,
			enrollmentSecret: 'password'
		}, admin, domain);
		const keyFile = path.resolve(__dirname, 'artifacts', 'clientKey');
		const certFile = path.resolve(__dirname, 'artifacts', 'clientCert');
		fsExtra.outputFileSync(certFile, certificate);
		const ecdsaKey = new ECDSA_Key(key, fsExtra);
		ecdsaKey.save(keyFile);
	});
	it('name overflow', async () => {
		try {
			await genUser({userName: 'david'.repeat(13), password: 'password'}, domain);
			should.fail('expect an error here');
		} catch (e) {
			logger.info(e);
			const regex = /{.*}/;
			const jsonString = e.message.match(regex)[0];
			logger.info('expect', jsonString);
			logger.info('But', 'Identity \'daviddaviddaviddaviddaviddaviddaviddaviddaviddaviddaviddaviddavid@icdd\' is already registered"');
		}
	});
});
