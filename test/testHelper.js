const path = require('path');
const testRoot = path.dirname(__dirname);
const {fsExtra} = require('../common/nodejs');
exports.writeArtifacts = (data, ...pathTokens) => {
	const debugFile = path.resolve(testRoot, 'artifacts', ...pathTokens);
	fsExtra.outputFileSync(debugFile, data);
};