#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
root=$(dirname $(dirname $CURRENT))

$root/install.sh

