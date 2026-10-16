"""Bounded offline Cloud gate, not a full corpus or hardware certification."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
NODE_TESTS = (
    "test_bulletin.cjs",
    "test_bible_translation_sidebar.cjs",
    "test_bible_catalog_order_20261016.cjs",
    "test_asv_reader_20261016.cjs",
    "test_worship_deleted_slot.cjs",
    "test_setlist_period.cjs",
    "test_song_timing.cjs",
)
SMOKES = (
    "smoke_startup_bootstrap.py",
    "smoke_atomic_save_runtime.py",
    "smoke_reference_batch.py",
    "smoke_theme_bootstrap.py",
)

def main():
    env = dict(os.environ, MINDEX_SMOKE_OFFLINE="1")
    # Do not forward production credentials inherited from a developer shell.
    for key in list(env):
        if "SUPABASE" in key.upper():
            del env[key]
    for name in NODE_TESTS + SMOKES:
        command = ["node" if name in NODE_TESTS else sys.executable, "tests/" + name]
        print("RUN", name, flush=True)
        subprocess.run(command, cwd=ROOT, env=env, check=True, timeout=180)
    print(f"PASS Cloud baseline: {len(NODE_TESTS)} unit + {len(SMOKES)} smoke entry points")
    print("Not covered: full regression suite, production DB, original corpus, physical output, signed desktop packages.")

if __name__ == "__main__":
    main()
