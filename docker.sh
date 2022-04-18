#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
export binPath=$CURRENT/common/bin/
export finalityRequired=true
down() {

	mocha dockerode-bootstrap.js --grep "^down "
	sudo rm -rf $CURRENT/stateVolumes/*
}

prepareNetwork() {
	# used in package.json
	mocha dockerode-bootstrap.js --grep "^up " --bail
}
restart() {
	down
	export channelName=allchannel
  npm start
}
cc() {
	# used in package.json
	mocha ./cc/golang/diagnose/install.js

}
nodejscc() {
	mocha ./cc/node/diagnose/install.js
}
if [[ -z "$1" ]]; then
	restart
else
	"$@"
fi
