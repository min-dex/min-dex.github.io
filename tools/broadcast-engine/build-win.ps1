$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../..')
if (![Environment]::Is64BitProcess -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'Windows x64 required' }
$stage = '.cache/engine-stage'
New-Item -ItemType Directory -Force $stage | Out-Null
python -m PyInstaller --noconfirm --clean --hidden-import win32timezone --onedir --name mindex-receiver --distpath $stage --workpath "$stage/work" --specpath $stage tools/broadcast-engine/receive.py
if ($LASTEXITCODE) { throw 'Could not freeze receiver' }
$ffmpeg = python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
if ($LASTEXITCODE) { throw 'Pinned FFmpeg wheel required' }
Copy-Item -LiteralPath $ffmpeg -Destination "$stage/mindex-receiver/ffmpeg.exe"
& $ffmpeg -L 2>&1 | Out-File "$stage/mindex-receiver/FFmpeg-LICENSE.txt"
if ($LASTEXITCODE) { throw 'Encoder identity check failed' }
