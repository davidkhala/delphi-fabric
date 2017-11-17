#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
if [ ! -f "$CURRENT/common/install.sh" ];then
    git submodule update --init --recursive
else
$CURRENT/common/install.sh

#   install mikefarah/yaml
wget https://github.com/mikefarah/yaml/releases/download/1.13.1/yaml_linux_amd64
chmod +x yaml_linux_amd64
sudo mv yaml_linux_amd64 /usr/local/bin/yaml



# write to config: jq do not support in-place editing, use moreutils:sponge
sudo apt -qq install -y moreutils

npm install