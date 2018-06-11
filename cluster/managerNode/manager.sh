#!/usr/bin/env bash
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
function down(){
    action=down node $CURRENT/nodeScripts/genPeer.js
    action=down node $CURRENT/nodeScripts/genOrderers.js
    action=down node $CURRENT/nodeScripts/caCryptoGen.js
    action=down node $CURRENT/nodeScripts/newCa.js
    action=down node $CURRENT/nodeScripts/swarmSync.js
}
function up(){
    node $CURRENT/nodeScripts/swarmSync.js
    node $CURRENT/nodeScripts/newCa.js
    node $CURRENT/nodeScripts/caCryptoGen.js
    node $CURRENT/nodeScripts/genOrderers.js
    node $CURRENT/nodeScripts/genPeer.js
}
if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi