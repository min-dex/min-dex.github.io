"""Local release wall time is exhaustive, secret-free and never verification evidence."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'cloud' / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value
queue, ci = module('release_queue'), module('record_ci_timing')


class ReleaseTiming(unittest.TestCase):
    def test_auth_wait_survives_slot_return_and_rejoin_without_recording_secrets(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            release = queue.update(root, 'start', owner='codex/test')['release']
            ticket = queue.update(root, 'join', owner='codex/test', release=release)['ticket']
            queue.update(root, 'claim', ticket=ticket)
            with contextlib.redirect_stderr(io.StringIO()):
                code = queue.run_recorded(root, release, 'push', [sys.executable, '-c',
                    "import sys;sys.stderr.write('Permission denied (publickey) PRIVATE_SENTINEL');sys.exit(1)"])
            self.assertEqual(code, 1)
            queue.update(root, 'leave', ticket=ticket)
            data = queue.load_journal(root, release)
            self.assertEqual([e['phase'] for e in data['events'] if 'phase' in e][-1], 'auth_wait')
            self.assertNotIn('PRIVATE_SENTINEL', json.dumps(data))
            self.assertNotIn('publickey', json.dumps(data))
            second = queue.update(root, 'join', owner='codex/test', release=release)['ticket']
            queue.update(root, 'claim', ticket=second)
            code = queue.run_recorded(root, release, 'local_checks', [sys.executable, '-c', 'raise SystemExit(2)'])
            self.assertEqual(code, 2)
            self.assertEqual(queue.load_journal(root, release)['events'][-1]['phase'], 'repair_wait')
            with self.assertRaises(ValueError):
                queue.finish_recorded(root, release, 'complete')
            queue.update(root, 'leave', ticket=second)
            report = queue.finish_recorded(root, release, 'abandoned')
            self.assertTrue(report['closed'])
            self.assertFalse(report['verificationEvidence'])
            self.assertIn('queue_wait', report['phasesSeconds'])
            self.assertIn('auth_wait', report['phasesSeconds'])
            self.assertIn('repair_wait', report['phasesSeconds'])

    def test_repeated_join_keeps_original_wait_and_final_stages_require_slot(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            release=queue.update(root,'start',owner='test')['release']
            with self.assertRaises(ValueError):
                queue.run_recorded(root,release,'push',['never-run'])
            first=queue.update(root,'join',owner='test',release=release)
            before=queue.load_journal(root,release)
            second=queue.update(root,'join',owner='test',release=release)
            self.assertEqual(first['ticket'],second['ticket'])
            self.assertEqual(before,queue.load_journal(root,release))
            self.assertEqual(len(queue.update(root,'status')['waiting']),1)
            queue.update(root,'claim',ticket=first['ticket'])
            again=queue.update(root,'join',owner='test',release=release)
            self.assertEqual(again['position'],0)
            self.assertEqual(again['ticket'],first['ticket'])

    def test_phase_intervals_cover_all_observed_time_without_overlap(self):
        data = {'release': 'a'*32, 'closed': True, 'events': [
            {'at':'2026-11-04T00:00:00+00:00','event':'started','phase':'queue_wait'},
            {'at':'2026-11-04T00:00:10+00:00','event':'claimed','phase':'preparing'},
            {'at':'2026-11-04T00:00:30+00:00','event':'command_started','phase':'ci'},
            {'at':'2026-11-04T00:01:00+00:00','event':'finished'}]}
        report = queue.timing_report(data)
        self.assertEqual(report['observedSeconds'], 60)
        self.assertEqual(report['phasesSeconds'], {'queue_wait':10, 'preparing':20, 'ci':30})
        data['events'][-1]['at']='2026-11-03T00:00:00+00:00'
        with self.assertRaises(ValueError): queue.timing_report(data)

    def test_queue_wall_retains_parallel_local_work(self):
        data={'release':'a'*32,'closed':True,'events':[
            {'at':'2026-11-04T00:00:00+00:00','event':'started','phase':'preparing'},
            {'at':'2026-11-04T00:00:10+00:00','event':'joined','phase':'queue_wait','ticket':'one'},
            {'at':'2026-11-04T00:00:20+00:00','event':'command_started','phase':'local_checks'},
            {'at':'2026-11-04T00:00:50+00:00','event':'claimed','phase':'preparing','ticket':'one'},
            {'at':'2026-11-04T00:01:00+00:00','event':'slot_released','ticket':'one'},
            {'at':'2026-11-04T00:01:00+00:00','event':'finished'}]}
        report=queue.timing_report(data)
        self.assertEqual(report['observedSeconds'],60)
        self.assertEqual(report['queueWallSeconds'],40)
        self.assertEqual(report['phasesSeconds']['queue_wait'],10)

    def test_running_command_requires_explicit_recovery_not_silent_success(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            release = queue.update(root, 'start', owner='test')['release']
            data = queue.load_journal(root, release)
            data['running']='interrupted-attempt'
            queue.save_journal(root, data)
            with self.assertRaises(ValueError):queue.run_recorded(root, release, 'push', ['never-run'])
            with self.assertRaises(ValueError):queue.finish_recorded(root, release, 'complete')
            report = queue.finish_recorded(root, release, 'abandoned', recover=True)
            self.assertFalse(report['closed'])
            self.assertEqual(queue.load_journal(root, release)['events'][-1]['event'], 'recovered')
            self.assertNotIn('running', queue.load_journal(root, release))

    def test_unknown_release_does_not_create_a_fake_start(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(FileNotFoundError):
                queue.update(Path(folder), 'join', owner='test', release='a'*32)
            with self.assertRaises(ValueError):queue.journal_path(Path(folder), '../private')

    def test_ci_metadata_pins_attempt_paginates_and_excludes_output(self):
        calls=[]
        job={'id':2,'name':'offline-web (0)','status':'completed','conclusion':'failure',
             'started_at':'2026-11-04T00:00:00Z','completed_at':'2026-11-04T00:00:10Z',
             'secret':'PRIVATE_SENTINEL','steps':[{'name':'check','status':'completed','conclusion':'failure',
             'started_at':'2026-11-04T00:00:02Z','completed_at':'2026-11-04T00:00:10Z','output':'PRIVATE_SENTINEL'}]}
        def get(path):
            calls.append(path)
            if '/jobs?' not in path:return {'id':1,'head_sha':'a'*40,'run_attempt':2,'status':'in_progress'}
            return {'jobs':[job]*100 if path.endswith('&page=1') else []}
        result=ci.collect(get,'owner/repo',1)
        self.assertIn('/attempts/2/jobs?',calls[1])
        self.assertEqual(len(calls),3)
        self.assertEqual(result['jobs'][0]['seconds'],10)
        self.assertEqual(result['jobs'][0]['steps'][0]['seconds'],8)
        self.assertNotIn('PRIVATE_SENTINEL',json.dumps(result))
        self.assertIsNone(ci.seconds(None,'2026-11-04T00:00:10Z'))

    def test_cli_preserves_child_arguments_and_records_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            subprocess.run(['git','init','-q',str(root)],check=True)
            script=str(ROOT/'cloud/release_queue.py')
            started=subprocess.check_output([sys.executable,script,'start','--owner','test'],cwd=root,text=True)
            release=json.loads(started)['release']
            code="import sys;assert sys.argv[1:]==['--owner','child'];raise SystemExit(7)"
            result=subprocess.run([sys.executable,script,'run','--release',release,'--phase','local_checks',
                                   '--',sys.executable,'-c',code,'--owner','child'],cwd=root,capture_output=True,text=True)
            self.assertEqual(result.returncode,7,result.stderr)
            report=json.loads(subprocess.check_output([sys.executable,script,'report','--release',release],cwd=root,text=True))
            self.assertIn('repair_wait',report['phasesSeconds'])
            journal=json.loads((root/'.git/mindex-release-queue/timings'/f'{release}.json').read_text())
            self.assertNotIn('child',json.dumps(journal))

    def test_sparse_bootstrap_omits_media_and_hydrates_exact_commit(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);origin=root/'origin';clone=root/'clone';origin.mkdir()
            def git(cwd,*args):return subprocess.check_output(['git',*args],cwd=cwd,stderr=subprocess.DEVNULL)
            git(origin,'init','-q');git(origin,'config','uploadpack.allowFilter','true')
            (origin/'cloud').mkdir();(origin/'assets').mkdir()
            (origin/'cloud/reuse_checks.py').write_text('fixture')
            media=bytes(range(256))*1024;(origin/'assets/video.bin').write_bytes(media)
            git(origin,'add','.');git(origin,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture')
            sha=git(origin,'rev-parse','HEAD')
            git(root,'clone','-q','--filter=blob:none','--no-checkout',origin.as_uri(),str(clone))
            git(clone,'sparse-checkout','set','cloud');git(clone,'checkout','-q','HEAD')
            self.assertTrue((clone/'cloud/reuse_checks.py').is_file())
            self.assertFalse((clone/'assets/video.bin').exists())
            blob=git(origin,'rev-parse','HEAD:assets/video.bin').decode().strip()
            self.assertIn('?'+blob,git(clone,'rev-list','--objects','--all','--missing=print').decode())
            git(clone,'sparse-checkout','disable')
            self.assertEqual((clone/'assets/video.bin').read_bytes(),media)
            self.assertEqual(git(clone,'rev-parse','HEAD'),sha)


if __name__ == '__main__':unittest.main()
