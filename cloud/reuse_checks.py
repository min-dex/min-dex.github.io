"""Reuse only a completed, successful same-repository branch gate for this SHA."""
import json
import os
import urllib.parse
import urllib.request


def verified_run(run, jobs, repository, sha, current_run):
    expected = {f'offline-web ({index})' for index in range(4)}
    checks = [job for job in jobs if job.get('name') in expected]
    return (
        str(run.get('id')) != str(current_run)
        and run.get('head_sha') == sha
        and run.get('head_repository', {}).get('full_name') == repository
        and run.get('path') == '.github/workflows/cloud-check.yml'
        and run.get('event') == 'push'
        and run.get('head_branch', '').startswith('codex/')
        and run.get('status') == 'completed'
        and run.get('conclusion') == 'success'
        and len(checks) == 4
        and {job['name'] for job in checks} == expected
        and all(job.get('status') == 'completed' and job.get('conclusion') == 'success' for job in checks)
    )


def find_verified(get, repository, sha, current_run):
    query = urllib.parse.urlencode({'head_sha': sha, 'event': 'push', 'status': 'success', 'per_page': 100})
    runs = get(f'/repos/{repository}/actions/workflows/cloud-check.yml/runs?{query}')['workflow_runs']
    for run in runs:
        # Jobs must belong to the successful attempt, never an earlier attempt.
        if not verified_run(run, [dict(name=f'offline-web ({i})', status='completed', conclusion='success') for i in range(4)], repository, sha, current_run):
            continue
        jobs = []
        for page in range(1, 101):
            batch = get(f'/repos/{repository}/actions/runs/{run["id"]}/attempts/{run["run_attempt"]}/jobs?per_page=100&page={page}')['jobs']
            jobs.extend(batch)
            if len(batch) < 100:
                break
        else:
            continue
        if verified_run(run, jobs, repository, sha, current_run):
            return str(run['id'])
    return ''


def main():
    receipt = ''
    if os.environ.get('GITHUB_EVENT_NAME') == 'push' and os.environ.get('GITHUB_REF') == 'refs/heads/main':
        def get(path):
            request = urllib.request.Request('https://api.github.com' + path, headers={
                'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'],
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            })
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.load(response)
        try:
            receipt = find_verified(get, os.environ['GITHUB_REPOSITORY'], os.environ['GITHUB_SHA'], os.environ['GITHUB_RUN_ID'])
        except Exception:
            # Missing/inaccessible/malformed evidence always falls back to real checks.
            print('Prior verification unavailable; running the complete gate.')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('reuse=' + ('true' if receipt else 'false') + '\n')
    if receipt:
        message = f'All four checks already passed for this exact SHA: https://github.com/{os.environ["GITHUB_REPOSITORY"]}/actions/runs/{receipt}'
        print(message)
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write(message + '\n')


if __name__ == '__main__':
    main()
