#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
config_dir="$CURRENT/config"
COMPANY='delphi' # must match to config_json
COMPOSE_FILE="$config_dir/docker-compose.yaml"
CONFIG_JSON="$config_dir/orgs.json"

dockerNetworkName=$(jq -r ".$COMPANY.docker.network" $CONFIG_JSON)


function down() {
    # NOTE deprecated: docker-compose -f $COMPOSE_FILE --project-name $projectName [action] :projectName is useless when setting network
	docker-compose -f $COMPOSE_FILE down
	./cluster/clean.sh
	docker network prune --force

}
function up() {
    docker network create $dockerNetworkName
	docker-compose -f $COMPOSE_FILE up
}

if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
