exports.nextVersion = (chaincodeVersion) => {
	const version = parseInt(chaincodeVersion.substr(1))
	return `v${version + 1}`
}