#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

CONFIG_DIR="$CURRENT/config"
COMPOSE_FILE="$CONFIG_DIR/docker-swarm.yaml"
CONFIG_JSON="$CONFIG_DIR/orgs.json"

swarmNetwork=$(jq -r ".docker.network" ${CONFIG_JSON})
stack=$(jq -r ".docker.stack" ${CONFIG_JSON})
volumesConfig=$(jq -r ".docker.volumes" $CONFIG_JSON)
CONFIGTXDir=$(echo $volumesConfig | jq -r ".CONFIGTX.dir")
MSPROOTDir=$(echo $volumesConfig | jq -r ".MSPROOT.dir")

function down() {
	docker stack rm $stack
	./cluster/clean.sh
}
function up() {

	local networkDriver="overlay"                                            # bridge(default)|host|null|overlay
	# NOTE Manager not online: The swarm does not have a leader. It's possible that too few managers are online. Make sure more than half of the managers are online.
	# NOTE when --driver="bridger" (as default) or network already exist :network "delphiNetwork" is declared as external, but it is not in the right scope: "local" instead of "swarm"
	# NOTE when not exist: network "delphiNetwork" is declared as external, but could not be found. You need to create a swarm-scoped network before the stack is deployed
	# then the scope is swarm, indicates that only hosts participating in the swarm can access this network
	if ! docker network inspect $swarmNetwork 1>/dev/null;then
        docker network create --driver $networkDriver --attachable $swarmNetwork
	fi
	docker stack up --compose-file=$COMPOSE_FILE $stack
}
if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
