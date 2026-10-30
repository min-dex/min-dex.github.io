import json
import fnmatch
import re
import unittest
from pathlib import Path


class ElectronRuntimeFilesTests(unittest.TestCase):
    def test_top_level_runtime_scripts_are_packaged(self):
        root = Path(__file__).resolve().parents[1]
        includes = json.loads((root / 'package.json').read_text(encoding="utf-8"))['build']['files']
        index_html = (root / 'index.html').read_text(encoding="utf-8")
        static_scripts = re.findall(r'<script src="\./([^?"/]+\.js)', index_html)
        runtime_scripts = re.findall(r'"(mindex(?:\.[A-Za-z0-9_-]+)+\.js|app(?:\.runtime)?\.js)"', index_html)
        scripts = sorted(set(static_scripts + runtime_scripts))
        for script in scripts:
            with self.subTest(script=script):
                packaged_by_glob = script.startswith('vendor/') and 'vendor/**/*' in includes
                self.assertTrue(script in includes or packaged_by_glob)
                self.assertTrue((root / script).is_file())

    def test_remote_and_draft_modules_are_packaged(self):
        root = Path(__file__).resolve().parents[1]
        includes = json.loads((root / 'package.json').read_text())['build']['files']
        for pattern in ('mindex.*.mjs', 'remote.*'):
            for source in root.glob(pattern):
                if source.suffix not in ('.js', '.mjs', '.css', '.webmanifest'): continue
                self.assertTrue(any(fnmatch.fnmatch(source.name,p) for p in includes if not p.startswith('!')),source.name)
        self.assertIn('mindex-build.json', includes)
        self.assertIn('!data/**/*', includes)
        self.assertNotIn('data/**/*', includes)

    def test_update_runtime_and_release_commands_are_available(self):
        root = Path(__file__).resolve().parents[1]
        package = json.loads((root / 'package.json').read_text(encoding="utf-8"))
        self.assertIn('electron/**/*', package['build']['files'])
        for name in ['electron/updater.js', 'electron/main.js', 'electron/preload.js',
                     'scripts/release-electron.mjs', 'scripts/verify-release.mjs']:
            self.assertTrue((root / name).is_file(), name)
        self.assertIn('zip', package['build']['mac']['target'])
        for name, command in package['scripts'].items():
            if name.startswith('electron:dist') or name.startswith('electron:pack'):
                self.assertIn('--publish never', command)

    def test_release_manifest_is_packaged_and_matches_loader_fallback(self):
        root = Path(__file__).resolve().parents[1]
        includes = json.loads((root / 'package.json').read_text(encoding="utf-8"))['build']['files']
        manifest = root / 'mindex-release.json'
        index_html = (root / 'index.html').read_text(encoding="utf-8")

        self.assertIn('mindex-release.json', includes)
        version = json.loads(manifest.read_text(encoding="utf-8"))['version']
        self.assertRegex(version, r'^[0-9A-Za-z._-]{4,80}$')
        self.assertIn(f'const fallbackVersion = "{version}"', index_html)


if __name__ == '__main__':
    unittest.main()
