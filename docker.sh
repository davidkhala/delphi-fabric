#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

function down() {
	node -e "require('./dockerode-bootstrap').down()"
}
function up() {
	node -e "require('./dockerode-bootstrap').up()"
}

if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
	node app/testChannel
	node app/testInstall
fi
