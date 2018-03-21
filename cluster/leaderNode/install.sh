#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}); pwd)
root=$(dirname $(dirname $CURRENT))

$root/install.sh

$root/common/ubuntu/nfs.sh installHost

# finally
sudo apt-get upgrade -y
sudo apt autoremove
