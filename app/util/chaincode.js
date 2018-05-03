exports.nextVersion = (chaincodeVersion) => {
	const version = parseInt(chaincodeVersion.substr(1));
	return `v${version + 1}`;
};
exports.reducer = ({ txEventResponses,proposalResponses }) =>{
	return {
		txs:txEventResponses.map(entry=>entry.tx),
		responses:proposalResponses.map((entry) => entry.response.payload.toString())};
};


exports.resultWrapper = (result,{proposalResponses}) =>
	Promise.resolve(
		{
			txEventResponses:result,
			proposalResponses
		}
	);