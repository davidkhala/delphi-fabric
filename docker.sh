#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

function down() {
	node -e "require('./dockerode-bootstrap').down()"
    sudo rm -rf /home/mediconcen/Documents/backupVolumes/peer1.icdd.org/
    mkdir -p /home/mediconcen/Documents/backupVolumes/peer1.icdd.org/
}
function up() {
	prepareNetwork
	node app/testChannel
	node app/masterInstall
	node app/testMasterCC.js
}

function prepareNetwork() {
	node -e "require('./dockerode-bootstrap').up()"
}

function restart() {
	down
	up
}

if [ -z "$1" ]; then
	restart
else
	$1
fi
