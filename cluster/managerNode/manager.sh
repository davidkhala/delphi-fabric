#!/usr/bin/env bash
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
function down(){
    action=down node $CURRENT/genPeer.js
    action=down node $CURRENT/genOrderers.js
    action=down node $CURRENT/caCryptoGen.js
    action=down node $CURRENT/newCa.js
    action=down node $CURRENT/swarmSync.js
}
function up(){
    node $CURRENT/swarmSync.js
    node $CURRENT/newCa.js
    node $CURRENT/caCryptoGen.js
    node $CURRENT/genOrderers.js
    node $CURRENT/genPeer.js
}
function orderer(){
    action=down node $CURRENT/genOrderers.js
    node $CURRENT/genOrderers.js
}
if [ -n "$1" ];then
    $1
else
	down
	up
fi