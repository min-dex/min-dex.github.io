"""Bounded offline Cloud gate, not a full corpus or hardware certification."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
NODE_TESTS = (
    "test_calendar_assignee_creation.cjs",
    "test_shared_offering_integrity.cjs",
    "test_music_fade_stop.cjs",
    "test_union_hymn_score_guard.cjs",
    "test_scripture_lookup_render.cjs",
    "test_app_runtime.cjs",
    "test_output_fullscreen_close.cjs",
    "test_ui_icons.cjs",
    "test_bulletin.cjs",
    "test_bible_translation_sidebar.cjs",
    "test_bible_catalog_order_20261016.cjs",
    "test_asv_reader_20261016.cjs",
    "test_worship_deleted_slot.cjs",
    "test_setlist_period.cjs",
    "test_song_timing.cjs",
    "test_independent_photo_timing.cjs",
    "test_children_library.cjs",
    "test_children_version_audio.cjs",
    "test_scripture_preload_parallel.cjs",
    "test_worship_unchanged_save.mjs",
    "test_worship_read_parallel.cjs",
)
SMOKES = (
    "smoke_service_entry.py",
    "smoke_form_label_spacing.py",
    "smoke_monitor_session.py",
    "smoke_monitor.py",
    "smoke_monitor_isolation.py",
    "smoke_version_row_alignment.py",
    "smoke_lyric_parentheses.py",
    "smoke_offering_projection.py",
    "smoke_offering_toggle.py",
    "smoke_global_playback.py",
    "smoke_output_session_isolation.py",
    "smoke_output_restart.py",
    "smoke_disclosure_feedback.py",
    "smoke_control_rhythm.py",
    "smoke_deferred_board_scroll.py",
    "smoke_presenter_font_cache.py",
    "smoke_startup_bootstrap.py",
    "smoke_atomic_save_runtime.py",
    "smoke_worship_audio_bundle.py",
    "smoke_independent_photo_timing.py",
    "smoke_song_photo_timing.py",
    "smoke_children_audio_db.py",
    "smoke_reference_batch.py",
    "smoke_theme_bootstrap.py",
    "smoke_theme_switch.py",
    "smoke_scripture_aliases.py",
    "smoke_startup_projection.py",
    "smoke_ui_font_cache.py",
    "smoke_stalled_download_recovery.py",
    "smoke_startup_overlap_recovery.py",
    "smoke_boot_loading_indicator.py",
)

def main():
    env = dict(os.environ, MINDEX_SMOKE_OFFLINE="1")
    # Do not forward production credentials inherited from a developer shell.
    for key in list(env):
        if "SUPABASE" in key.upper():
            del env[key]
    for name in ("test_pages_gate.py",) + NODE_TESTS + SMOKES:
        command = ["node" if name in NODE_TESTS else sys.executable, "tests/" + name]
        print("RUN", name, flush=True)
        subprocess.run(command, cwd=ROOT, env=env, check=True, timeout=180)
    print(f"PASS Cloud baseline: {len(NODE_TESTS)} unit + {len(SMOKES)} smoke entry points")
    print("Not covered: full regression suite, production DB, original corpus, physical output, signed desktop packages.")

if __name__ == "__main__":
    main()
