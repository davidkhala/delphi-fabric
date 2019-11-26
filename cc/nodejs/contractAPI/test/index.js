const install = require('../install');
const task = async (taskID) => {
	switch (taskID) {
		default:
			await install.task();
	}
};

task(process.env.taskID);