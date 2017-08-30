#!/usr/bin/env bash


ACTION=$1
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

COMPANY="delphi"
CONFIG_JSON="$CURRENT/orgs.json"


network=$(jq -r ".$COMPANY.docker.network" $CONFIG_JSON)
# stack deploy :Aliases:  deploy, up
# stack rm: Aliases:  rm, remove, down
if [ "$ACTION" == "up" ];then
    docker stack up --compose-file=docker-compose.yaml $network
elif [ "$ACTION" == "down" ];then
    docker stack rm $network
fi
