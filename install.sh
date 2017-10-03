#!/usr/bin/env bash
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
$CURRENT/common/install.sh

# to use sponge
sudo apt -qq install -y moreutils

