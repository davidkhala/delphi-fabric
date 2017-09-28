#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

CONFIG_DIR="$CURRENT/config"
COMPOSE_FILE="$CONFIG_DIR/docker-swarm.yaml"
COMPANY="delphi"
CONFIG_JSON="$CONFIG_DIR/orgs.json"

swarmNetwork=$(jq -r ".$COMPANY.docker.network" ${CONFIG_JSON})
volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)
CONFIGTXDir=$(echo $volumesConfig | jq -r ".CONFIGTX.dir")
MSPROOTDir=$(echo $volumesConfig | jq -r ".MSPROOT.dir")
CONFIGTXVolume=$(echo $volumesConfig | jq -r ".CONFIGTX.swarm")
MSPROOTVolume=$(echo $volumesConfig | jq -r ".MSPROOT.swarm")
function createVolume() {
	./common/docker/utils/volume.sh createLocal $MSPROOTVolume $MSPROOTDir
	./common/docker/utils/volume.sh createLocal $CONFIGTXVolume $CONFIGTXDir

	#mountBase="/var/lib/docker-volumes/_glusterfs"
	#CONFIGTXMount="$mountBase/configtxMount"
	#MSPROOTMount="$mountBase/mspRootMount"
	#mount $CONFIGTXDir $CONFIGTXMount
	#echo "$CONFIGTXDir $CONFIGTXMount xfs defaults 0 0" >> /etc/fstab
	#mount $MSPROOTDir $MSPROOTMount

	# self is not in Peer, use self_ip instead :Error: Host ubuntu is not in 'Peer in Cluster' state
	#./config/gluster.sh createVolume $CONFIGTXVolume "$this_ip:$CONFIGTXDir" "$manager0_ip:$manager0_glusterRoot/CONFIGTX"
	#./config/gluster.sh createVolume $MSPROOTVolume "$this_ip:$MSPROOTDir" "$manager0_ip:$manager0_glusterRoot/MSPROOT"
	## TODO provide an api to generate folder in other host machine
	## TODO need $GOPATH/bin/docker-volume-glusterfs
	#servers="$this_ip:$manager0_ip"

	#docker volume create --driver=hjdr4plugins/docker-volume-glusterfs $MSPROOTVolume
	#docker volume create --driver=hjdr4plugins/docker-volume-glusterfs $CONFIGTXVolume

}

function down() {
	docker stack rm $swarmNetwork
	FILTER="dev"
    ./common/rmChaincodeContainer.sh container $FILTER
	./common/rmChaincodeContainer.sh image $FILTER
	docker network prune --force
	docker volume prune --force
}
function up() {

	local networkDriver="overlay"                                            # bridge(default)|host|null|overlay
	# NOTE Manager not online: The swarm does not have a leader. It's possible that too few managers are online. Make sure more than half of the managers are online.
	# NOTE when --driver="bridger" (as default) or network already exist :network "delphiNetwork" is declared as external, but it is not in the right scope: "local" instead of "swarm"
	# NOTE when not exist: network "delphiNetwork" is declared as external, but could not be found. You need to create a swarm-scoped network before the stack is deployed
	docker network create --driver $networkDriver --attachable $swarmNetwork # then the scope is swarm, indicates that only hosts participating in the swarm can access this network
	createVolume
	docker stack up --compose-file=$COMPOSE_FILE $swarmNetwork

}
if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
