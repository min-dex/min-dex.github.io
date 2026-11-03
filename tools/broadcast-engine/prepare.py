"""Stage verified FFmpeg binaries by target architecture before desktop packaging."""
import hashlib
import pathlib
import shutil
import subprocess
import sys
import tempfile
import zipfile

targets = {
    'mac-arm64': ('macosx_11_0_arm64', 'b1ae3173414b5fc5f538a726c4e48ea97edc0d2cdc11f103afee655c463fa742'),
    'mac-x64': ('macosx_10_9_x86_64', '9d2baaf867088508d4a3458e61eeb30e945c4ad8016025545f66c4b5aaef0a61'),
    'win-x64': ('win_amd64', '02fa47c83703c37df6bfe4896aab339013f62bf02c5ebf2dce6da56af04ffc0a'),
}
for target, (platform, digest) in targets.items():
    if not target.startswith('win' if sys.platform == 'win32' else 'mac'):
        continue
    dest = pathlib.Path('.cache/broadcast-engine') / target
    dest.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        subprocess.run([sys.executable, '-m', 'pip', 'download', '--no-deps', '--only-binary=:all:',
                        '--platform', platform, '--dest', temp, 'imageio-ffmpeg==0.6.0'], check=True)
        wheel, = pathlib.Path(temp).glob('*.whl')
        if hashlib.sha256(wheel.read_bytes()).hexdigest() != digest:
            raise RuntimeError('Unexpected encoder package')
        with zipfile.ZipFile(wheel) as archive:
            name, = [s for s in archive.namelist() if s.startswith('imageio_ffmpeg/binaries/ffmpeg-')]
            binary = dest / ('ffmpeg.exe' if platform == 'win_amd64' else 'ffmpeg')
            with archive.open(name) as src, binary.open('wb') as out:
                shutil.copyfileobj(src, out)
            binary.chmod(0o755)
            for name in archive.namelist():
                if 'license' in name.lower() and not name.endswith('/'):
                    (dest / pathlib.Path(name).name).write_bytes(archive.read(name))
