const {installAll, approveAll} = require('../../../app/installHelper');
const helper = require('../../../app/helper');
const diagnose = 'diagnose';

const task = async () => {
	switch (parseInt(process.env.taskID)) {
		case 0: {
			const packageID = await installAll(diagnose);
			console.info(packageID);
		}
			break;
		case 1: {
			// taskID=1 node cc/golang/diagnose/install.js
			const packageId = 'diagnose:9d8facc42ee9e0c985c4dd0d10818cec6a0b6a6e9657d2586b526cf4f7b06ad5';
			await approveAll(packageId);
		}
			break;
		default: {
			const orderers = helper.newOrderers();
			const orderer = orderers[0];
			const packageID = await installAll(diagnose);
			await approveAll(packageID, orderer);

		}
	}

};
task();
