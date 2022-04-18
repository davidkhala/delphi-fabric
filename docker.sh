#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
export binPath=$CURRENT/common/bin/

down() {

	npm stop
	sudo rm -rf $CURRENT/stateVolumes/*
}

prepareNetwork() {
	npm run prestart
}
restart() {
	down
	export channelName=allchannel
  npm start
}
cc() {
	npm run poststart
}

if [[ -z "$1" ]]; then
	restart
else
	"$@"
fi
