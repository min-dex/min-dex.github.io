#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'if(Number(process.versions.node.split(".")[0])<22)throw Error("Node 22+ required")'
python3 -m venv .cache/cloud-venv
.cache/cloud-venv/bin/python -m pip install -r cloud/requirements.txt
.cache/cloud-venv/bin/python -m playwright install --with-deps chromium webkit
# No production keys, corpus download, migration, or deployment in setup.
