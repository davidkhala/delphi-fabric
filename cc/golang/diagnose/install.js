const {installAll} = require('../../../app/installHelper');
const diagnose = 'diagnose';

const task = async () => {
	await installAll(diagnose);
};
task();
