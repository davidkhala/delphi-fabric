const task = async () => {
	require('./channelInitTest');
	require('./serviceDiscoveryTest');
	require('./offlineSigningTest');
	await require('./fabric-network/diagnose');
};
task().catch(err => {
	console.error(err);
	process.exit(1);
});
