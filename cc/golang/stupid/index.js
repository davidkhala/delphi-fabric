const install = require('./install');
const flow = async () => {
	await install.task();
};
flow();
