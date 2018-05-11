#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

function down() {
	node -e "require('./config/dockerode-bootstrap').down(true)"
}
function up() {
	node -e "require('./config/dockerode-bootstrap').up(true)"
}
if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
