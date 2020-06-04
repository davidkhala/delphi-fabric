#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
m1="install and approve"
mocha $CURRENT/install.js --grep "^${m1} install$"
mocha $CURRENT/install.js --grep "^${m1} query installed & approve$"
m2="commit"
mocha $CURRENT/install.js --grep "^${m2} commit$"
mocha $CURRENT/invoke.js --grep "^chaincode Initialize init$"

