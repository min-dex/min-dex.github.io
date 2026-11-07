"""Publish only same-SHA, fully verified church installers. No signing credentials."""
import hashlib, json, os, pathlib, subprocess, time

def gh(*args):
    return subprocess.check_output(['gh', *args], text=True)
def main():
    root=pathlib.Path('.')
    policy=json.loads((root/'internal-release.json').read_text(encoding='utf-8'))
    version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
    assert policy == {'version':version,'delivery':'church-internal','publish':True}
    sha=os.environ['GITHUB_SHA']; repo=os.environ['GITHUB_REPOSITORY']
    assert repo=='min-dex/min-dex.github.io' and os.environ['GITHUB_REF']=='refs/heads/main'
    # Main's successful web run includes Pages. Never reuse checks from another SHA.
    for _ in range(40):
        runs=json.loads(gh('api',f'repos/{repo}/actions/runs?head_sha={sha}&event=push&per_page=100'))['workflow_runs']
        web=[run for run in runs if run['name']=='Cloud web checks' and run['head_branch']=='main' and run['head_sha']==sha]
        if web and max(web,key=lambda r:r['id'])['conclusion']=='success': break
        if web and max(web,key=lambda r:r['id'])['conclusion'] in ['failure','cancelled','timed_out']: raise RuntimeError('Same-SHA web gate failed')
        time.sleep(30)
    else: raise RuntimeError('Same-SHA web/Pages gate not complete')
    assert json.loads(gh('api',f'repos/{repo}/git/ref/heads/main'))['object']['sha']==sha
    files=[root/'release-artifacts'/f'Mindex-{version}-{target}' for target in ['mac-arm64.dmg','mac-x64.dmg','win-x64.exe']]
    records=[]
    for file in files:
        assert file.is_file() and file.stat().st_size>1000000
        digest=hashlib.sha256()
        with file.open('rb') as stream:
            for chunk in iter(lambda:stream.read(1024*1024),b''): digest.update(chunk)
        records.append({'file':file.name,'bytes':file.stat().st_size,'sha256':digest.hexdigest()})
    receipt=root/'release-artifacts'/'internal-build.json'
    receipt.write_text(json.dumps({'version':version,'channel':'internal','sourceCommit':sha,'assets':records},indent=2)+'\n',encoding='utf-8')
    sums=root/'release-artifacts'/'SHA256SUMS.txt'
    sums.write_text(''.join(f"{x['sha256']}  {x['file']}\n" for x in records),encoding='utf-8')
    notes=root/'release-artifacts'/'release-notes.md'
    notes.write_text(f'Mindex {version} 교회 내부용\n\n미서명 설치본입니다. 첫 실행 시 운영체제의 보안 확인이 필요할 수 있습니다.\n\n앱의 업데이트 메뉴에서 새 설치 파일을 받을 수 있습니다. 설치 전 편집 내용을 저장하고 송출·앱을 종료해 주세요. Mac은 앱 교체, Windows는 설치 파일 실행 방식입니다. 자동 설치하지 않습니다.\n\n방송실 장비 검증은 보류되어 있으며 실제 유튜브 방송으로 검증한 배포가 아닙니다.\n\n소스: '+sha+'\n',encoding='utf-8')
    tag='church-v'+version
    # Immutable version: an existing tag/release requires human reconciliation.
    existing=subprocess.run(['gh','release','view',tag],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if existing.returncode==0: raise RuntimeError('Version already exists; do not replace installers')
    gh('release','create',tag,'--target',sha,'--title',f'Mindex {version} · 교회 내부용','--notes-file',str(notes),'--draft')
    gh('release','upload',tag,*map(str,files),str(receipt),str(sums))
    # Drafts have no public tag endpoint yet. Resolve their release ID first.
    draft=json.loads(gh('release','view',tag,'--json','databaseId'))
    release_id=draft['databaseId']
    assert isinstance(release_id,int) and release_id>0
    uploaded=json.loads(gh('api',f'repos/{repo}/releases/{release_id}'))
    assert uploaded['draft']
    assets={a['name']:a for a in uploaded['assets']}
    for item in records:
        assert assets[item['file']]['size']==item['bytes']
        assert assets[item['file']].get('digest')=='sha256:'+item['sha256']
    assert json.loads(gh('api',f'repos/{repo}/git/ref/heads/main'))['object']['sha']==sha
    gh('release','edit',tag,'--draft=false','--latest')
    print('Published',tag,sha)
if __name__=='__main__': main()
