#!/usr/bin/env bash
# TODO not ready

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

GOPATH_SYS="/home/david/go"
config_dir="$CURRENT/config"
CONFIG_JSON="$config_dir/orgs.json"
SWARM_CONFIG="$config_dir/swarm.json"
CRYPTO_CONFIG_FILE="$config_dir/crypto-config.yaml"
configtx_file="$config_dir/configtx.yaml"
CRYPTO_CONFIG_DIR="$config_dir/crypto-config/"
COMPANY='delphi' # must match to config_json
CONFIGTX_OUTPUT_DIR="$config_dir/configtx"
BLOCK_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.block"
VERSION=$(jq -r ".${COMPANY}.docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"

TLS_ENABLED=true
COMPOSE_FILE="$config_dir/docker-swarm.yaml"
volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)
CONFIGTXDir=$(echo $volumesConfig | jq -r ".CONFIGTX.dir")
MSPROOTDir=$(echo $volumesConfig | jq -r ".MSPROOT.dir")

function _changeHostName() {
	sudo gedit /etc/hostname /etc/hosts
}
function createSwarm() {
	ip="$1"
	docker swarm init --advertise-addr=${ip}
}
function _gluster(){
# TODO not ready
manager0_glusterRoot="/home/david/Documents/gluster"
gluster peer probe $this_ip
gluster peer probe $manager0_ip
gluster peer status
echo

}

thisHost=$(jq ".$COMPANY.thisHost" $SWARM_CONFIG)
thisHostName=$(echo $thisHost | jq -r ".hostname" )
otherHostConfig=$(jq ".$COMPANY.otherHost" $SWARM_CONFIG)
manager0Config=$(echo $otherHostConfig | jq ".manager0" )
manager0_hostname=$(echo $manager0Config | jq -r ".hostname")

this_ip=$(./common/docker/utils/swarm.sh getNodeIP)
manager0_ip=$(./common/docker/utils/swarm.sh getNodeIP $manager0_hostname)

CONFIGTXVolume=$(echo $volumesConfig | jq -r ".CONFIGTX.swarm")
MSPROOTVolume=$(echo $volumesConfig | jq -r ".MSPROOT.swarm")

function createVolume(){
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
./common/docker/utils/swarm.sh addNodeLabels $thisHostName CONFIGTX=$CONFIGTXDir
./common/docker/utils/swarm.sh addNodeLabels $thisHostName MSPROOT=$MSPROOTDir
./common/docker/utils/swarm.sh getNodeLabels

./config/swarm-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR $BLOCK_FILE -s $TLS_ENABLED -v $IMAGE_TAG
createVolume
