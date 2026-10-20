"""Bounded offline Cloud gate, not a full corpus or hardware certification."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
NODE_TESTS = (
    "test_union_subtitle_display.cjs",
    "test_linked_song_parallel_load.cjs",
    "test_draft_handoff.mjs",
    "test_audio_db_only.cjs",
    "test_server_state.mjs",
    "test_editor_draft_merge.mjs",
    "test_editor_draft_recovery.cjs",
    "test_server_storage.cjs",
    "test_legacy_state.mjs",
    "test_worship_store.mjs",
    "test_worship_atomic_client.mjs",
    "test_domain_boundaries.cjs",
    "test_form_input_normalization.cjs",
    "test_worship_form_model.cjs",
    "test_live_refresh_scheduler.cjs",
    "test_hymn_score_runtime.cjs",
    "test_hymn_intro_plan.cjs",
    "test_department_assignee_requests.cjs",
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
    "test_setlist_leader_edit.cjs",
    "test_setlist_archive_loading.cjs",
    "test_song_timing.cjs",
    "test_independent_photo_timing.cjs",
    "test_children_version_audio.cjs",
    "test_scripture_preload_parallel.cjs",
    "test_worship_unchanged_save.mjs",
    "test_worship_read_parallel.cjs",
)
SMOKES = (
    "smoke_reference_validation.py",
    "smoke_presenter_freshness.py",
    "smoke_shell_icons.py",
    "smoke_praise_progressive_loading.py",
    "smoke_version_output_title.py",
    "smoke_hymn_measures.py",
    "smoke_sidebar_control_affordance.py",
    "smoke_module_landings.py",
    "smoke_home_start.py",
    "smoke_music_seek.py",
    "smoke_controller_music_layout.py",
    "smoke_citation_translation_editor.py",
    "smoke_explicit_worship_order.py",
    "smoke_section_editor_actions.py",
    "smoke_draft_handoff.py",
    "smoke_source_metadata_validation.py",
    "smoke_server_state.py",
    "smoke_server_bulletin.py",
    "smoke_server_presenter_transport.py",
    "smoke_lyric_paragraph_boundaries.py",
    "smoke_hymn_reviewed.py",
    "smoke_praise_liturgical_section.py",
    "smoke_closing_hymn_projection.py",
    "smoke_manuals_layout.py",
    "smoke_department_tabs.py",
    "smoke_department_remote.py",
    "smoke_worship_live.py",
    "smoke_content_live.py",
    "smoke_operations_live.py",
    "smoke_archive_live.py",
    "smoke_shared_settings_live.py",
    "smoke_scripture_live.py",
    "smoke_department_assignees.py",
    "smoke_service_entry.py",
    "smoke_form_label_spacing.py",
    "smoke_monitor_session.py",
    "smoke_monitor.py",
    "smoke_monitor_isolation.py",
    "smoke_version_row_alignment.py",
    "smoke_lyric_parentheses.py",
    "smoke_offering_projection.py",
    "smoke_offering_toggle.py",
    "smoke_offering_layout.py",
    "smoke_global_playback.py",
    "smoke_presenter_focus_view.py",
    "smoke_presenter_focus.py",
    "smoke_output_session_isolation.py",
    "smoke_output_restart.py",
    "smoke_disclosure_feedback.py",
    "smoke_control_rhythm.py",
    "smoke_editor_field_system.py",
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

def selected_tests(shard_index=0, shard_count=1):
    if shard_count < 1 or not 0 <= shard_index < shard_count:
        raise ValueError("shard index must be within a positive shard count")
    unit = ("test_pages_gate.py", "test_cloud_check.py") + NODE_TESTS if shard_index == 0 else ()
    return unit + SMOKES[shard_index::shard_count]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    args = parser.parse_args()
    try:
        selected = selected_tests(args.shard_index, args.shard_count)
    except ValueError as error:
        parser.error(str(error))
    env = dict(os.environ, MINDEX_SMOKE_OFFLINE="1")
    # Do not forward production credentials inherited from a developer shell.
    for key in list(env):
        if "SUPABASE" in key.upper():
            del env[key]
    started = time.monotonic()
    if args.shard_index == 0:
        print("RUN manual content/document consistency", flush=True)
        subprocess.run(["node", "tools/build_manual_docs.cjs", "--check"], cwd=ROOT, env=env, check=True, timeout=30)
    for name in selected:
        command = ["node" if name in NODE_TESTS else sys.executable, "tests/" + name]
        print("RUN", name, flush=True)
        test_started = time.monotonic()
        subprocess.run(command, cwd=ROOT, env=env, check=True, timeout=180)
        print(f"DONE {name}: {time.monotonic() - test_started:.1f}s", flush=True)
    label = "Cloud baseline" if args.shard_count == 1 else f"Cloud shard {args.shard_index + 1}/{args.shard_count} (not the whole gate)"
    print(f"PASS {label}: {len(selected)} entry points in {time.monotonic() - started:.1f}s")
    print("Not covered: full regression suite, production DB, original corpus, physical output, signed desktop packages.")

if __name__ == "__main__":
    main()
