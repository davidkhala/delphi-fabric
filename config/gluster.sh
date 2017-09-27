#!/usr/bin/env bash
fcn="$1"
remain_params=""
for ((i = 2; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
function install(){
    # install glusterFS:    https://gluster.readthedocs.io/en/latest/Install-Guide/Install/
    sudo add-apt-repository ppa:gluster/glusterfs-3.12
    sudo apt-get update
    sudo apt-get install glusterfs-server
}
function init(){
    systemctl start glusterd.service
    systemctl enable glusterd.service
}
function add(){
    ip="$1"
    gluster peer probe $ip
}
function remove(){
    gluster peer detach $1 force
    # peer detach itself: failed: ubuntu is localhost

}
function lsPeer(){
    gluster pool list
}
function rmVolume(){

    gluster volume stop "$1" # TODO the force stop is not ready?
    gluster volume delete "$1"

}
function infoVolume(){
    gluster volume info
}
function startVolume(){
    gluster volume start $1
}
function stopVolume(){
    gluster volume stop $1
}
function createVolume(){
    local name="$1"
    local replica=0 #replica count should be greater than 1
    local remain_params=""
    for ((i = 2; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
    done
    local entries=""
    for entry in $remain_params; do
        entries="$entries $entry"
        ((replica++))
    done
    gluster volume create $name replica $replica $entries force
    startVolume $name
}
$fcn $remain_params
