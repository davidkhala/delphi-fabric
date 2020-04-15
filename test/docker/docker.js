// docker run --detach --publish=3001:3001 --env deployment=$deployment --name ucare fabric-middleware-ucare
const {action} = process.env;
const Cmd = ['node', 'ping.js'];
const Image = 'ping-docker';
const container = 'test-docker';
const portMap = '';
const {homeResolve} = require('khala-nodeutils/helper');
const {docker: {volumes: {MSPROOT}}} = require('../../config/orgs');
const {containerStart, containerDelete, ContainerOptsBuilder} = require('khala-dockerode/dockerode-util');
const {imageBuild} = require('khala-dockerode/dockerCmd');
const up = async () => {
	const builder = new ContainerOptsBuilder(Image, Cmd);
	builder.setName(container);
	// builder.setPortBind(portMap);
	const network = 'delphiNetwork';

	const envObject = {};

	builder.setVolume(homeResolve(MSPROOT, 'peerOrganizations/astri.org/tlsca/tlsca.astri.org-cert.pem'), '/root/ca.crt');
	builder.setVolume(homeResolve(MSPROOT, 'peerOrganizations/astri.org/client/clientKey'), '/root/clientKey');
	builder.setVolume(homeResolve(MSPROOT, 'peerOrganizations/astri.org/client/clientCert'), '/root/clientCert');

	builder.setNetwork(network, []);
	builder.setEnvObject(envObject);

	await containerStart(builder.build());
};
const down = async () => {
	await containerDelete(container);
};
const build = async () => {
	await imageBuild(__dirname, Image);
};
const restart = async () => {
	await down();
	await build();
	await up();
};
const task = async () => {
	await eval(`${action}()`);

};
task();
