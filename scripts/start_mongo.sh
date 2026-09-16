#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DBPATH="$DIR/data/db"
LOGPATH="$DIR/data/mongod.log"

mkdir -p "$DBPATH"

if pgrep -x "mongod" > /dev/null; then
    echo "[MongoDB] mongod is already running."
else
    echo "[MongoDB] Starting local mongod with dbpath=$DBPATH..."
    ~/.local/bin/mongod --dbpath "$DBPATH" --fork --logpath "$LOGPATH" --bind_ip 127.0.0.1 --port 27017
    echo "[MongoDB] Started successfully."
fi
