#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
root=$(dirname $(dirname $CURRENT))

if [ -z "$(ls -A $root/common)" ];then
    git submodule update --init --recursive
fi

$root/common/install.sh

$root/common/ubuntu/nfs.sh installClient

# finally
sudo apt upgrade -y
sudo apt autoremove