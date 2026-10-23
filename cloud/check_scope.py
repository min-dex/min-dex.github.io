"""Conservative CSS-only gate planning; uncertain changes retain the full gate."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CSS_SCREENS = {
    'styles.css': None,  # Shared shell/theme/layout: every UI smoke remains relevant.
    'styles.presenter-output.css': (
        'smoke_presenter_common_fit.py', 'smoke_transition_logo.py',
        'smoke_fullscreen_praise.py', 'smoke_service_design.py',
        'smoke_announcement_type.py', 'smoke_children_theme.py',
        'smoke_remote_preview.py', 'smoke_version_output_title.py',
        'smoke_hymn_measures.py', 'smoke_praise_liturgical_section.py',
        'smoke_closing_hymn_projection.py', 'smoke_offering_projection.py',
        'smoke_presenter_focus.py', 'smoke_presenter_font_cache.py',
        'smoke_theme_switch.py', 'smoke_startup_projection.py',
    ),
    'styles.bulletin.css': ('smoke_server_bulletin.py', 'smoke_department_tabs.py',
                            'smoke_editor_field_system.py', 'smoke_theme_switch.py'),
    'styles.calendar.css': ('smoke_operations_live.py', 'smoke_home_start.py',
                            'smoke_module_landings.py', 'smoke_theme_switch.py'),
    'styles.monitor.css': ('smoke_monitor.py', 'smoke_monitor_session.py',
                           'smoke_monitor_isolation.py', 'smoke_theme_switch.py'),
    'remote.css': ('smoke_presenter_remote.py', 'smoke_remote_phone.py',
                   'smoke_remote_preview.py', 'smoke_remote_lifecycle.py', 'smoke_remote_video.py'),
    'remote.shared.css': ('smoke_presenter_remote.py', 'smoke_remote_phone.py',
                          'smoke_remote_preview.py', 'smoke_remote_lifecycle.py', 'smoke_remote_video.py'),
}
CSS_NODE_TESTS = ('test_app_runtime.cjs', 'test_ui_icons.cjs',
                  'test_remote_theme.cjs', 'test_bulletin.cjs')
PROOF_PREFIX = 'Scope proof: '


def full_plan(reason):
    return dict(profile='full', smokes=[], signature='full', base='', reason=reason)


def metadata_only(path, before, after):
    if path == 'index.html':
        def normalize(text):
            for key in ('fallbackVersion', 'compiledAppVersion'):
                pattern = rf'(const {key} = ")[A-Za-z0-9._-]+(";)'
                text, count = re.subn(pattern, r'\1VERSION\2', text)
                if count != 1:
                    raise ValueError('ambiguous release declarations')
            return text
        try:
            return normalize(before) == normalize(after)
        except ValueError:
            return False
    if path in ('mindex-release.json', 'app.runtime.json'):
        try:
            old, new = json.loads(before), json.loads(after)
            if not isinstance(old, dict) or not isinstance(new, dict):
                return False
            if not all(isinstance(data.get('version'), str) and
                       re.fullmatch(r'[A-Za-z0-9._-]+', data['version']) for data in (old, new)):
                return False
            old.pop('version'); new.pop('version')
            return old == new and (path != 'mindex-release.json' or not old)
        except (ValueError, TypeError):
            return False
    return False


def classify(changes, read, all_smokes, base, baseline_verified):
    """changes contains status/path pairs; read(ref,path) returns committed UTF-8."""
    css = []
    for status, path in changes:
        if status != 'M':
            return full_plan('Added/deleted/renamed/type-changed file')
        if path in CSS_SCREENS:
            css.append(path)
        elif path.startswith('docs/') and path.endswith('.md'):
            continue
        elif path not in ('index.html', 'mindex-release.json', 'app.runtime.json') or not metadata_only(path, read(base, path), read('HEAD', path)):
            return full_plan('Non-CSS behavior/data/config/test change: ' + path)
    if not css:
        return full_plan('No bounded CSS change')
    if not baseline_verified:
        return full_plan('Comparison baseline is not a verified published main commit')
    smokes = set()
    for path in css:
        smokes.update(all_smokes if CSS_SCREENS[path] is None else CSS_SCREENS[path])
    if not smokes or not smokes <= set(all_smokes):
        return full_plan('Unknown screen coverage')
    smokes = sorted(smokes)
    signature = 'css-' + hashlib.sha256(json.dumps([base, smokes]).encode()).hexdigest()[:20]
    return dict(profile='css', smokes=smokes, signature=signature, base=base,
                reason='CSS screens: ' + ', '.join(sorted(css)))


def jobs_for_run(get, repository, run):
    jobs = []
    for page in range(1, 101):
        batch = get(f'/repos/{repository}/actions/runs/{run["id"]}/attempts/{run["run_attempt"]}/jobs?per_page=100&page={page}')['jobs']
        jobs.extend(batch)
        if len(batch) < 100:
            return jobs
    return []


def published_baseline(get, repository, sha):
    runs = get(f'/repos/{repository}/actions/workflows/cloud-check.yml/runs?head_sha={sha}&event=push&status=success&per_page=100')['workflow_runs']
    expected = {f'offline-web ({i})' for i in range(4)} | {'deploy-pages'}
    for run in runs:
        if (run.get('head_sha') != sha or run.get('head_branch') != 'main'
            or run.get('head_repository', {}).get('full_name') != repository
            or run.get('path') != '.github/workflows/cloud-check.yml'
            or run.get('event') != 'push' or run.get('status') != 'completed'
            or run.get('conclusion') != 'success'):
            continue
        jobs = [job for job in jobs_for_run(get, repository, run) if job.get('name') in expected]
        if (len(jobs) == len(expected) and {job['name'] for job in jobs} == expected
            and all(job.get('status') == 'completed' and job.get('conclusion') == 'success' for job in jobs)):
            return True
    return False


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, timeout=60).decode('utf-8')


def build_plan():
    from check import SMOKES
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    kind = os.environ.get('GITHUB_EVENT_NAME')
    if kind == 'push' and os.environ.get('GITHUB_REF') == 'refs/heads/main':
        base = event.get('before', '')
    elif kind == 'push' and os.environ.get('GITHUB_REF', '').startswith('refs/heads/codex/'):
        # One plan job takes the main snapshot for every shard in this run.
        git('fetch', '--no-tags', '--depth=1', 'origin', 'main')
        base = git('rev-parse', 'FETCH_HEAD').strip()
    elif kind == 'pull_request':
        base = event.get('pull_request', {}).get('base', {}).get('sha', '')
    else:
        return full_plan('Manual/unknown event')
    if not re.fullmatch(r'[0-9a-f]{40}', base) or set(base) == {'0'}:
        return full_plan('Missing comparison baseline')
    git('fetch', '--no-tags', '--depth=1', 'origin', base)
    rows = git('diff', '--name-status', '--no-renames', '-z', base, 'HEAD').split('\0')
    if rows[-1] != '' or len(rows) % 2 != 1:
        return full_plan('Unrecognized diff')
    changes = list(zip(rows[0:-1:2], rows[1:-1:2]))
    def read(ref, path):
        return git('show', f'{ref}:{path}')
    # Avoid network evidence requests for mixed behavior changes.
    candidate = classify(changes, read, SMOKES, base, True)
    if candidate['profile'] != 'css':
        return candidate
    for path in CSS_SCREENS.keys() & {path for _, path in changes}:
        for ref in (base, 'HEAD'):
            if not git('ls-tree', ref, '--', path).startswith('100644 blob '):
                return full_plan('Non-regular CSS file')
    def get(path):
        request = urllib.request.Request('https://api.github.com' + path, headers={
            'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'],
            'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'})
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response)
    if not published_baseline(get, os.environ['GITHUB_REPOSITORY'], base):
        return full_plan('Unverified/unpublished baseline')
    return candidate


def main():
    try:
        plan = build_plan()
    except Exception as error:
        # No file names, missing Git history or API failures may shrink the gate.
        plan = full_plan('Scope unavailable: ' + type(error).__name__)
    print(json.dumps(plan, ensure_ascii=False), flush=True)
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        for key in ('profile', 'signature'):
            output.write(f'{key}={plan[key]}\n')
        output.write('smokes=' + json.dumps(plan['smokes']) + '\n')
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
        summary.write(f'## {plan["profile"]} gate\n\n{plan["reason"]}\n\nBaseline: `{plan["base"]}`\n\n')
        summary.write('\n'.join('- ' + name for name in plan['smokes']) + '\n')


if __name__ == '__main__':
    main()
