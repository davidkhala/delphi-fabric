#!/usr/bin/env bash
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
$CURRENT/common/install.sh

# write to config: jq do not support in-place editing, use moreutils:sponge
sudo apt -qq install -y moreutils

