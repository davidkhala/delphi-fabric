#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

down() {
	node -e "require('./dockerode-bootstrap').down()"
}
up() {
	prepareNetwork
	node app/testChannel
}

prepareNetwork() {
	node -e "require('./dockerode-bootstrap').up()"
}
peerRecoverTest() {
	down
	sudo rm -rf $HOME/Documents/backupVolumes/
	mkdir -p $HOME/Documents/backupVolumes/peer1.icdd.org/
	up
	node app/testPeerBackup
}
ordererRecoverTest() {
	down
	sudo rm -rf $HOME/Documents/backupVolumes/
	mkdir -p $HOME/Documents/backupVolumes/orderer2/
	up
	node app/testOrdererBackup
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
if [ -z "$1" ]; then
	restart
else
	$1
fi
