#!/bin/sh
# Build dependency: Python 3.9+, PyInstaller 6.16.0. Runtime is self-contained.
set -eu
cd "$(dirname "$0")/../.."
test "$(uname -sm)" = "Darwin arm64"
ffmpeg=${1:?Pass the imageio-ffmpeg 0.6.0 macOS arm64 FFmpeg 7.1 executable}
hash=$(shasum -a 256 "$ffmpeg" | cut -d' ' -f1)
test "$hash" = 6d175a4743ca50256e89a8cdd731100f9cee33bd79aeea46894d209410dc6617
stage=.cache/engine-stage
mkdir -p "$stage"
export PYINSTALLER_CONFIG_DIR="$PWD/$stage/pyinstaller-cache"
python -m PyInstaller --noconfirm --clean --onedir --name mindex-receiver --target-arch arm64 --distpath "$stage" --workpath "$stage/work" --specpath "$stage" tools/broadcast-engine/receive.py
cp "$ffmpeg" "$stage/mindex-receiver/ffmpeg"
"$ffmpeg" -L > "$stage/mindex-receiver/FFmpeg-LICENSE.txt" 2>&1
