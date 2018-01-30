#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
root=$(dirname $(dirname $CURRENT))

$root/install.sh

$root/common/ubuntu/nfs.sh installHost

# finally
sudo apt-get upgrade -y
sudo apt autoremove
