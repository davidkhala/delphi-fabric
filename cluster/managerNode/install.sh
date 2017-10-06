#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
root=$(dirname $(dirname $CURRENT))

if [ -z "$(ls -A $root/common)" ];then
    git submodule update --init --recursive
fi

$root/common/install.sh

$root/common/ubuntu/nfs.sh installClient

# finally
apt upgrade -y
apt autoremove