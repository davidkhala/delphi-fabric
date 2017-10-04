#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
root=$(dirname $(dirname $CURRENT))

$root/install.sh

$root/common/ubuntu/nfs.sh installClient

# finally
apt upgrade -y
apt autoremove