#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
root=$(dirname $(dirname $CURRENT))

$root/common/install.sh

# write to config: jq do not support in-place editing, use moreutils:sponge
apt -qq install -y moreutils

$root/common/ubuntu/nfs.sh installHost

# finally
apt-get upgrade -y
apt autoremove
