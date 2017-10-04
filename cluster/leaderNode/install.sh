#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
root=$(dirname $(dirname $CURRENT))

$root/install.sh

$root/common/ubuntu/nfs.sh installHost

# finally
apt-get upgrade -y
apt autoremove
