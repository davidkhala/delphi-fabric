require('./channelInitTest');
require('./serviceDiscoveryTest');
require('./fabric-network/diagnose');
require('./offlineSigningTest');
process.env.taskID = 0;
require('./operationTest');
process.env.taskID = 1;
require('./operationTest');
