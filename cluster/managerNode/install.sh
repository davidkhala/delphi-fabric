#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
root=$(dirname $(dirname $CURRENT))

if [ -z "$(ls -A $root/common)" ]; then
	git submodule update --init --recursive
fi

$root/common/install.sh

# finally
sudo apt autoremove -y
