"""Stage only public files committed at the tested HEAD, never the working tree."""
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

DEVELOPMENT_DIRECTORIES = frozenset({'.github', 'cloud', 'tests', 'tools', 'migrations', 'electron'})


def is_public_path(path):
    return not (path.parts and path.parts[0] in DEVELOPMENT_DIRECTORIES)


def stage(root, destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    # Keep all runtime assets/data/docs; omit only top-level development tooling.
    # Always use tested committed bytes, not local fixtures or working-tree edits.
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
            bundle.extractall(destination, members=[m for m in members if is_public_path(Path(m.name))])
    subprocess.run(['node', str(Path(__file__).resolve().parents[1] / 'scripts/product-identity.cjs'),
                    str(root), str(destination)], check=True)
    if not (destination / 'index.html').is_file():
        raise ValueError('Pages entry point missing')


if __name__ == '__main__':
    stage(Path(__file__).resolve().parents[1], sys.argv[1])
