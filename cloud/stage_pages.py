"""Stage only public files committed at the tested HEAD, never the working tree."""
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile


def stage(root, destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    # Preserve the existing public repository payload, without CI caches,
    # untracked local backups, credentials or test-generated working-tree edits.
    with tempfile.TemporaryFile() as archive:
        subprocess.run(['git', 'archive', '--format=tar', 'HEAD'], cwd=root,
                       stdout=archive, check=True)
        archive.seek(0)
        with tarfile.open(fileobj=archive) as bundle:
            members = bundle.getmembers()
            for member in members:
                path = Path(member.name)
                if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
                    raise ValueError('Pages artifact must contain regular relative files only')
                if path.name == '.env' or path.name.startswith('.env.'):
                    raise ValueError('Environment files are not publishable')
            bundle.extractall(destination, members=members)
    if not (destination / 'index.html').is_file():
        raise ValueError('Pages entry point missing')


if __name__ == '__main__':
    stage(Path(__file__).resolve().parents[1], sys.argv[1])
