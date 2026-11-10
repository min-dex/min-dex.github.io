"""Install an unsigned TEST artifact in a marker-owned temporary directory only."""
import errno
import json, os, pathlib, shutil, subprocess, sys, tempfile, time
artifact=pathlib.Path(sys.argv[1]).resolve()
state=pathlib.Path(sys.argv[2]).resolve()
if state.exists():
    saved=json.loads(state.read_text()); root=pathlib.Path(saved['root'])
    assert root.parent.resolve()==pathlib.Path(tempfile.gettempdir()).resolve()
    assert not root.is_symlink() and root.name.startswith('mindex-install-qa-')
    assert (root/'fixture-only').read_text()=='kr.mindex.app.test'
else:
    root=pathlib.Path(tempfile.mkdtemp(prefix='mindex-install-qa-')).resolve()
    (root/'fixture-only').write_text('kr.mindex.app.test')
internal = len(sys.argv)>3 and sys.argv[3]=='internal'
assert artifact.name.startswith('Mindex-' if internal else 'Mindex-Test-')
app_name = 'Mindex' if internal else 'Mindex Test'
if sys.platform=='darwin':
    mount=root/'mounted'; mount.mkdir(exist_ok=True)
    subprocess.run(['hdiutil','attach',str(artifact),'-nobrowse','-readonly','-mountpoint',str(mount)],check=True,stdout=subprocess.DEVNULL)
    try:
        source=mount/(app_name+'.app'); destination=root/(app_name+'.app')
        if destination.exists(): shutil.rmtree(destination)
        subprocess.run(['ditto',str(source),str(destination)],check=True)
    finally:
        # Disk Arbitration can briefly hold the CI volume after ditto exits.
        for attempt in range(5):
            result = subprocess.run(['hdiutil', 'detach', str(mount)], stdout=subprocess.DEVNULL)
            if result.returncode != errno.EBUSY or attempt == 4:
                result.check_returncode()
                break
            time.sleep(attempt + 1)
    exe=destination/'Contents/MacOS'/app_name
elif sys.platform=='win32':
    assert os.environ.get('GITHUB_ACTIONS')=='true'
    destination=root/'installed'
    subprocess.run([str(artifact),'/S','/currentuser','/D='+str(destination)],check=True,timeout=240)
    exe=destination/(app_name+'.exe')
else: raise RuntimeError('Native runner required')
assert exe.is_file()
saved={'root':str(root),'exe':str(exe),'appId':'kr.mindex.app.test'}
state.write_text(json.dumps(saved))
print(str(exe))
