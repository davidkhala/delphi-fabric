const task = async () => {
	require('./channelInitTest');
	require('./serviceDiscoveryTest');
	require('./offlineSigningTest');
	require('./fabric-network/index');
};
task().catch(err => {
	console.error(err);
	process.exit(1);
});
