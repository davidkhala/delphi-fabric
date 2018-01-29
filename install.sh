#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
fcn=$1

function cn() {
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
	$CURRENT/common/install.sh cn
	apt -qq install -y moreutils
	npm install
}
function gitSync() {
	git pull
	git submodule update --init --recursive
}

if [ -n "$fcn" ]; then
	$fcn
else
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
	$CURRENT/common/install.sh
	# write to config: jq do not support in-place editing, use moreutils:sponge
	apt -qq install -y moreutils
	npm install
	if ! go version; then
		$CURRENT/common/install.sh golang
	fi
fi
