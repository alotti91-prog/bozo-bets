#!/bin/sh
# Start the Emergency Hub. Open http://127.0.0.1:8080 afterwards.
cd "$(dirname "$0")" && exec python3 hub.py "$@"
