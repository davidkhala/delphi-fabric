const logger = require('khala-logger/log4js').consoleLogger('bootstrap');
const DockerodeBootstrap = require('./nodePkg/dockerode-bootstrap');
const globalConfig = require('./config/orgs.json');
const path = require('path');
const configtxYaml = path.resolve(__dirname, 'config', 'configtx.yaml');
const dockerodeBootstrap = new DockerodeBootstrap(globalConfig, configtxYaml);
const task = async () => {
	const {action} = process.env;
	try {
		switch (action) {
			case 'down':
				await dockerodeBootstrap.down();
				logger.debug('[done] down');
				break;
			case 'up':
				await dockerodeBootstrap.up();
				logger.debug('[done] up');
				break;
			default:
		}
	} catch (err) {
		logger.error(err);
		process.exit(1);
	}

};
task();