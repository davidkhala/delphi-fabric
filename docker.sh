#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
config_dir="$CURRENT/config"
COMPOSE_FILE="$config_dir/docker-compose.yaml"
CONFIG_JSON="$config_dir/orgs.json"

dockerNetworkName=$(jq -r ".docker.network" $CONFIG_JSON)

function down() {
	# NOTE deprecated: docker-compose -f $COMPOSE_FILE --project-name $projectName [action] :projectName is useless when setting network
	docker-compose -f $COMPOSE_FILE down
	./cluster/clean.sh
}
function up() {
	docker network create $dockerNetworkName
	docker-compose -f $COMPOSE_FILE up -d
}

if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
