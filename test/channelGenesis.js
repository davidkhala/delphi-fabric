const appHelper = require('../app/helper')
const channelFile = appHelper.projectResolve('config/configtx/all.tx');
const ProtoLoader = require('../common/nodejs/builder/protobuf');
const protobufLoader = new ProtoLoader('/home/davidliu/Documents/delphi-fabric/common/nodejs/node_modules');
const fs = require('fs');
const config_envelope = fs.readFileSync(channelFile);
const _commonProto = protobufLoader.require('common/common.proto').common;
const task = () => {
	const envelope = _commonProto.Envelope.decode(config_envelope);
	console.log(envelope);
};
task();