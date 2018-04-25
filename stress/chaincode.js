exports.invokeAsync= (channel, richPeers, { chaincodeId, fcn, args }, client = channel._clientContext) => {
	const txId = client.newTransactionID();

	const request = {
		chaincodeId,
		fcn,
		args,
		txId,
		targets: richPeers //optional: use channel.getPeers() as default
	};
	return channel.sendTransactionProposal(request).
	then(helper.chaincodeProposalAdapter('invoke')).
	then(({ nextRequest, errCounter }) => {
		const { proposalResponses } = nextRequest;

		if (errCounter >0) {
			return Promise.reject({ proposalResponses })
		}

		return channel.sendTransaction(nextRequest)
	})

};
exports.invokeProposal= (channel, richPeers, { chaincodeId, fcn, args }, client = channel._clientContext) => {
	const txId = client.newTransactionID();

	const request = {
		chaincodeId,
		fcn,
		args,
		txId,
		targets: richPeers //optional: use channel.getPeers() as default
	};
	return channel.sendTransactionProposal(request)
};