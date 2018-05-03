exports.getGOPATH = async () => {

	const util = require('util');
	const exec = util.promisify(require('child_process').exec);

	const {stdout, stderr} = await exec('go env GOPATH');
	if (stderr) {
		throw stderr;
	}
	return stdout;
};
exports.setGOPATH = async () => {
	process.env.GOPATH = await module.exports.getGOPATH();
};