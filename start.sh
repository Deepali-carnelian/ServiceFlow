#!/usr/bin/env sh
cd "$(dirname "$0")"
rm -f data/active-port.txt
node server.js
