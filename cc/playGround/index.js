const task = async () => {
	const {get, put, history, list, compositeKey} = require('./playgroundInvoke');

	const helper = require('../../app/helper');

	const install = require('./playgroundInstall');
	const flow = async () => {
		await install.task();
		const org1 = 'icdd';
		const org2 = 'ASTRI.org';
		const clientOrg = org2;
		await put(helper.newPeers([0], org1), clientOrg, 'a', 'b');
		const result = await get(helper.newPeers([0], org1), clientOrg, 'a');
		console.log(result);
		const result2 = await history(helper.newPeers([0], org1), clientOrg, 'a');
		console.log(result2);
	};
	const flow2 = async () => {
		await install.task();
		const org1 = 'icdd';
		const org2 = 'ASTRI.org';
		const clientOrg = org2;
		await put(helper.newPeers([0], org1), clientOrg, 'a', 'b');
		const result = await list(helper.newPeers([0], org1), clientOrg);
		console.log(result);
		const result2 = await compositeKey(helper.newPeers([0], org1), clientOrg, 'car','tesla');
		console.log(result2);
	};
	flow2();
};
task();