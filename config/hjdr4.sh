#!/usr/bin/env bash
# TODO not ready
glusterRestContainerName="glusterrest"

function runRestService(){
    local port="$1"
    docker run -d --name $glusterRestContainerName \
        -v /var/run/glusterd.socket:/var/run/glusterd.socket -p $port:9000 \
        hjdr4/docker-glusterrestd
}
function stopRestService(){
    docker container stop $glusterRestContainerName
    docker container rm $glusterRestContainerName
}
function createDockerVolume(){
local glusterVolumeName="$1" # existing gluster volume
docker volume create --driver=hjdr4plugins/docker-volume-glusterfs $glusterVolumeName
}



