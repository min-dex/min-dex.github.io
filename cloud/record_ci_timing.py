"""Read-only GitHub timing metadata; no logs, credentials or app data in artifacts."""
import json
import os
from pathlib import Path
import urllib.request
from datetime import datetime


def seconds(start, end):
    if not start or not end:
        return None
    value = (datetime.fromisoformat(end.replace('Z', '+00:00')) -
             datetime.fromisoformat(start.replace('Z', '+00:00'))).total_seconds()
    return value if value >= 0 else None


def summarize(run, jobs):
    rows = []
    for job in jobs:
        rows.append({key: job.get(key) for key in ('id', 'name', 'status', 'conclusion', 'started_at', 'completed_at')})
        row = rows[-1]
        row['seconds'] = seconds(row['started_at'], row['completed_at']) if row['status'] == 'completed' else None
        row['steps'] = []
        for step in job.get('steps', []):
            item = {key: step.get(key) for key in ('name', 'status', 'conclusion', 'started_at', 'completed_at')}
            item['seconds'] = seconds(item['started_at'], item['completed_at']) if item['conclusion'] not in (None, 'skipped') else None
            row['steps'].append(item)
    return {'version': 1, 'run': {key: run.get(key) for key in
            ('id', 'head_sha', 'run_attempt', 'created_at', 'run_started_at', 'updated_at', 'status', 'conclusion')},
            'jobs': rows, 'note': 'Parallel job/step durations are not additive. Collector may observe its own job in progress; unfinished values remain null.'}


def collect(get, repository, run_id):
    base = f'/repos/{repository}/actions/runs/{run_id}'
    run = get(base)
    # Pin to this attempt; earlier attempt success cannot replace a current failure.
    jobs = []
    for page in range(1, 101):
        batch = get(base + f'/attempts/{run["run_attempt"]}/jobs?per_page=100&page={page}')['jobs']
        jobs.extend(batch)
        if len(batch) < 100:
            return summarize(run, jobs)
    raise ValueError('Too many job pages; timing evidence is incomplete')


def main():
    repository, run_id = os.environ['GITHUB_REPOSITORY'], os.environ['GITHUB_RUN_ID']
    def get(path):
        request = urllib.request.Request('https://api.github.com' + path, headers={
            'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'],
            'Accept': 'application/vnd.github+json'})
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)
    result = collect(get, repository, run_id)
    target = Path(os.environ['RUNNER_TEMP']) / 'release-timing.json'
    target.write_text(json.dumps(result, indent=2) + '\n')
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
        summary.write('## Release timing (read-only metadata)\n\n')
        for job in result['jobs']:
            summary.write(f"- {job['name']}: {job['conclusion'] or job['status']}, {job['seconds']} seconds\n")
        summary.write('\nParallel durations must not be summed; local queue/auth/repair journal is separate.\n')


if __name__ == '__main__':
    main()
