const path = require('path');
const testRoot = __dirname;
const fsExtra = require('fs-extra');
exports.writeArtifacts = (data, ...pathTokens) => {
	const debugFile = path.resolve(testRoot, 'artifacts', ...pathTokens);
	fsExtra.outputFileSync(debugFile, data);
};