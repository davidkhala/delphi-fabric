const logger = require('./logger').new('multi-signature');
exports.signs = (clientSwitchPromises, proto) => {
	const signatures = [];
	let promiseChain = Promise.resolve();
	for (const promise of clientSwitchPromises) {
		promiseChain = promiseChain.then(() => promise)
			.then((client) => {
				logger.debug('signature identity', client.getUserContext().getName());
				signatures.push(client.signChannelConfig(proto));
				return Promise.resolve();
			});
	}
	return promiseChain.then(() => {
		return {signatures, proto};
	});
};
exports.toBase64 = (signatures)=>{
	return signatures.map(({signature_header,signature})=>{
		return {
			signature_header:signature_header.toBase64(),
			signature:signature.toBase64()
		};
	});
};
exports.fromBase64 =(signatures)=>{
	const ByteBuffer = require('bytebuffer');

	return signatures.map(({signature_header,signature})=>{
		return {
			signature_header:ByteBuffer.fromBase64(signature_header),
			signature:ByteBuffer.fromBase64(signature)
		};
	});
};