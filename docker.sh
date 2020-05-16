#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
export binPath=$CURRENT/common/bin/
down() {
	action=down node ./bootstrap.js
	sudo rm -rf $CURRENT/stateVolumes/*
}
up() {
	prepareNetwork
	#	taskID=0 useSignconfigtx=true channelName=allchannel node app/channelSetup.js
	taskID=0 channelName=allchannel node app/channelSetup.js
	sleep 1 # TODO wait for ready
	taskID=1 channelName=allchannel node app/channelSetup.js

	sleep 3 # TODO wait for ready: FIXME [allchannel] channel update: status=[BAD_REQUEST], info=[error applying config update to existing channel 'allchannel': error authorizing update: unexpected EOF]
#	taskID=2 viaServer=true channelName=allchannel node app/channelSetup.js
	#	taskID=2 viaServer=true channelName=allchannel node app/channelSetup.js #
	#	channelName=extrachannel node app/channelSetup.js
}

prepareNetwork() {
	action=up node ./bootstrap.js
}
restart() {
	down
	up
}
repeat() {
	local times=5
	for ((i = 1; i <= times; i++)); do
		./docker.sh
	done
}
if [[ -z "$1" ]]; then
	restart
else
	$1
fi
