const task = async () => {
	require('./channelInitTest');
	require('./serviceDiscoveryTest');
	{
		process.env.chaincodeId = 'diagnose';
		process.env.taskID = 0;
		await require('./fabric-network');
	}

	require('./offlineSigningTest');
	process.env.taskID = 0;
	require('./operationTest');
	process.env.taskID = 1;
	require('./operationTest');
};
task();

