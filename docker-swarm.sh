#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
fcn=$1

function down() {
	node -e "require('./dockerode-bootstrap').down(true)"
}
function prepareNetwork() {
	node -e "require('./dockerode-bootstrap').up(true)"
}
function up() {
	prepareNetwork
	node app/testChannel.js
}
function chaincode(){
    name=stress node app/testInstall.js
}
if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
