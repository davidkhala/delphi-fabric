const {down, up} = require('./dockerode-bootstrap');
const task = async () => {
	const {action} = process.env;
	try {
		switch (action) {
			case 'down':
				await down();
				logger.debug('[done] down');
				break;
			case 'up':
				await up();
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