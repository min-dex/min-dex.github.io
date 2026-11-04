"""Install an unsigned TEST artifact in a marker-owned temporary directory only."""
import json, os, pathlib, shutil, subprocess, sys, tempfile
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
assert artifact.name.startswith('Mindex-Test-')
if sys.platform=='darwin':
    mount=root/'mounted'; mount.mkdir(exist_ok=True)
    subprocess.run(['hdiutil','attach',str(artifact),'-nobrowse','-readonly','-mountpoint',str(mount)],check=True,stdout=subprocess.DEVNULL)
    try:
        source=mount/'Mindex Test.app'; destination=root/'Mindex Test.app'
        if destination.exists(): shutil.rmtree(destination)
        subprocess.run(['ditto',str(source),str(destination)],check=True)
    finally:
        subprocess.run(['hdiutil','detach',str(mount)],check=True,stdout=subprocess.DEVNULL)
    exe=destination/'Contents/MacOS/Mindex Test'
elif sys.platform=='win32':
    assert os.environ.get('GITHUB_ACTIONS')=='true'
    destination=root/'installed'
    subprocess.run([str(artifact),'/S','/currentuser','/D='+str(destination)],check=True,timeout=240)
    exe=destination/'Mindex Test.exe'
else: raise RuntimeError('Native runner required')
assert exe.is_file()
saved={'root':str(root),'exe':str(exe),'appId':'kr.mindex.app.test'}
state.write_text(json.dumps(saved))
print(str(exe))
