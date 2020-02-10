const path = require('path');
const testRoot = __dirname;
const {fsExtra} = require('khala-nodeutils/helper');
exports.writeArtifacts = (data, ...pathTokens) => {
	const debugFile = path.resolve(testRoot, 'artifacts', ...pathTokens);
	fsExtra.outputFileSync(debugFile, data);
};