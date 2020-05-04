const path = require('path');
const channelFile = path.resolve('../config/configtx/all.tx');
const ProtoLoader = require('../common/nodejs/builder/protobuf');
const protobufLoader = new ProtoLoader('/home/davidliu/Documents/delphi-fabric-release-1.4/common/nodejs/node_modules');
const fs = require('fs');
const config_envelope = fs.readFileSync(channelFile);
const _commonProto = protobufLoader.require('common/common.proto').common;
const task = () => {
	const envelope = _commonProto.Envelope.decode(config_envelope);
	console.log(envelope);
};
task();