"""Bounded offline Cloud gate, not a full corpus or hardware certification."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
NODE_TESTS = (
    "test_product_identity.cjs",
    "test_electron_test_isolation.cjs",
    "test_praise_id_aliases.cjs",
    "test_praise_classification.cjs",
    "test_praise_groups.cjs",
    "test_single_song.cjs",
    "test_remote_core.mjs",
    "test_remote_pairing.mjs",
    "test_output_pairing.mjs",
    "test_output_registry.mjs",
    "test_remote_screen.mjs",
    "test_remote_theme.cjs",
    "test_remote_session.mjs",
    "test_union_subtitle_display.cjs",
    "test_linked_song_parallel_load.cjs",
    "test_draft_handoff.mjs",
    "test_audio_db_only.cjs",
    "test_server_state.mjs",
    "test_editor_draft_merge.mjs",
    "test_editor_draft_recovery.cjs",
    "test_save_input_retention.cjs",
    "test_server_storage.cjs",
    "test_disclosure_state.cjs",
    "test_legacy_state.mjs",
    "test_worship_store.mjs",
    "test_worship_atomic_client.mjs",
    "test_domain_boundaries.cjs",
    "test_form_input_normalization.cjs",
    "test_worship_form_model.cjs",
    "test_live_refresh_scheduler.cjs",
    "test_content_entry_refresh.cjs",
    "test_hymn_score_runtime.cjs",
    "test_hymn_intro_plan.cjs",
    "test_hymn_slide_estimates.cjs",
    "test_department_assignee_requests.cjs",
    "test_calendar_assignee_creation.cjs",
    "test_children_default_completion.cjs",
    "test_children_worship_template.cjs",
    "test_children_order_defaults.mjs",
    "test_worship_template_preservation.cjs",
    "test_shared_offering_integrity.cjs",
    "test_music_fade_stop.cjs",
    "test_playback_transition_ownership.cjs",
    "test_union_hymn_score_guard.cjs",
    "test_scripture_lookup_render.cjs",
    "test_keynote_html.mjs",
    "test_keynote_html_attachment.mjs",
    "test_keynote_html_bridge.mjs",
    "test_app_runtime.cjs",
    "test_runtime_boundaries.cjs",
    "test_presenter_return.cjs",
    "test_output_fullscreen_close.cjs",
    "test_output_stop_recovery.cjs",
    "test_ui_icons.cjs",
    "test_bulletin.cjs",
    "test_bible_translation_sidebar.cjs",
    "test_bible_catalog_order_20261016.cjs",
    "test_asv_reader_20261016.cjs",
    "test_worship_deleted_slot.cjs",
    "test_worship_slot_identity.cjs",
    "test_setlist_period.cjs",
    "test_setlist_links.cjs",
    "test_setlist_leader_edit.cjs",
    "test_setlist_archive_loading.cjs",
    "test_song_timing.cjs",
    "test_independent_photo_timing.cjs",
    "test_children_version_audio.cjs",
    "test_scripture_preload_parallel.cjs",
    "test_worship_unchanged_save.mjs",
    "test_worship_read_parallel.cjs",
)
CSS_NODE_TESTS = (
    "test_single_song.cjs",'test_app_runtime.cjs', 'test_ui_icons.cjs',
                  'test_remote_theme.cjs', 'test_bulletin.cjs')
SMOKES = (
    "smoke_audio_presence.py",
    "smoke_praise_groups.py",
    "smoke_single_song.py",
    "smoke_single_song_lifecycle.py",
    "smoke_single_song_activation.py",
    "smoke_worship_native_version_picker.py",
    "smoke_native_praise_mode_reference.py",
    "smoke_presenter_return.py",
    "smoke_controller_slide_blocks.py",
    "smoke_future_outline_consistency.py",
    "smoke_empty_presenter_inputs.py",
    "smoke_legacy_title_restore.py",
    "smoke_song_form_width.py",
    "smoke_input_feedback_sync.py",
    "smoke_medley_unlink.py",
    "smoke_editor_save_status.py",
    "smoke_service_browse_categories.py",
    "smoke_presenter_window_buttons.py",
    "smoke_service_structural_order.py",
    "smoke_special_service_order.py",
    "smoke_title_songform.py",
    "smoke_form_default_placeholder.py",
    "smoke_lyrics_form.py",
    "smoke_presenter_common_fit.py",
    "smoke_media_viewport_fit.py",
    "smoke_media_source_identity.py",
    "smoke_transition_logo.py",
    "smoke_fullscreen_praise.py",
    "smoke_service_design.py",
    "smoke_announcement_type.py",
    "smoke_children_theme.py",
    "smoke_presenter_remote.py",
    "smoke_remote_preview.py",
    "smoke_remote_phone.py",
    "smoke_remote_panel.py",
    "smoke_remote_lifecycle.py",
    "smoke_remote_multi_lifecycle.py",
    "smoke_remote_adapter.py",
    "smoke_remote_admin.py",
    "smoke_remote_directory.py",
    "smoke_save_shortcut.py",
    "smoke_input_request_races.py",
    "smoke_praise_input_keyboard.py",
    "smoke_department_input_ime.py",
    "smoke_background_nov_dec.py",
    "smoke_background_church_year.py",
    "smoke_calendar_late_failure.py",
    "smoke_bulletin_status_semantics.py",
    "smoke_praise_header_layout.py",
    "smoke_product_info.py",
    "smoke_remote_video.py",
    "smoke_reference_validation.py",
    "smoke_praise_atomic_save.py",
    "smoke_praise_discard_retry.py",
    "smoke_praise_lifecycle.py",
    "smoke_presenter_freshness.py",
    "smoke_native_freshness_title.py",
    "smoke_deck_original.py",
    "smoke_keynote_html.py",
    "smoke_keynote_cards.py",
    "smoke_shell_icons.py",
    "smoke_praise_progressive_loading.py",
    "smoke_version_output_title.py",
    "smoke_version_order.py",
    "smoke_version_audio_summary.py",
    "smoke_version_audio_input.py",
    "smoke_hymn_measures.py",
    "smoke_sidebar_control_affordance.py",
    "smoke_module_landings.py",
    "smoke_home_start.py",
    "smoke_music_seek.py",
    "smoke_controller_music_layout.py",
    "smoke_citation_translation_editor.py",
    "smoke_disclosure_persistence.py",
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
    "smoke_setlist_return.py",
    "smoke_setlist_years.py",
    "smoke_calendar_years.py",
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
    "smoke_presenter_left_input.py",
    "smoke_presenter_left_input_save.py",
    "smoke_hymn_number_create_guard.py",
    "smoke_hymn_number_input_save.py",
    "smoke_presenter_inline_editor.py",
    "smoke_holy_week_prayers.py",
    "smoke_preparation_service_matrix.py",
    "smoke_preparation_form_default.py",
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
    "smoke_video_end_transition.py",
    "smoke_children_audio_db.py",
    "smoke_praise_media.py",
    "smoke_reference_batch.py",
    "smoke_theme_bootstrap.py",
    "smoke_theme_switch.py",
    "smoke_scripture_aliases.py",
    "smoke_startup_projection.py",
    "smoke_ui_font_cache.py",
    "smoke_stalled_download_recovery.py",
    "smoke_runtime_dependency_upgrade.py",
    "smoke_startup_overlap_recovery.py",
    "smoke_boot_loading_indicator.py",
)

GOVERNANCE_TESTS = ("test_praise_id_transition.py", "test_readonly_bookkeeping.py", "solid_audit.py", "test_pages_gate.py", "test_cloud_check.py", "test_reuse_checks.py", "test_check_scope.py", "test_release_queue.py")


def selected_tests(shard_index=0, shard_count=1, *, smokes=None, node_tests=None):
    smokes = SMOKES if smokes is None else tuple(smokes)
    node_tests = NODE_TESTS if node_tests is None else tuple(node_tests)
    if shard_count < 1 or not 0 <= shard_index < shard_count:
        raise ValueError("shard index must be within a positive shard count")
    unit = GOVERNANCE_TESTS + node_tests if shard_index == 0 else ()
    if shard_count == 1:
        return unit + smokes
    # Durations affect scheduling only; the explicit allowlist owns coverage.
    import json
    timings = json.loads((ROOT / 'cloud/smoke_timings.json').read_text())
    groups = [[] for _ in range(shard_count)]
    loads = [7.0] + [0.0] * (shard_count - 1)  # unit/manual checks on shard 0
    for name in sorted(smokes, key=lambda name: -timings.get(name, 10.0)):
        target = min(range(shard_count), key=lambda index: loads[index])
        groups[target].append(name)
        loads[target] += timings.get(name, 10.0)
    return unit + tuple(groups[shard_index])


def scope_parameters():
    profile = os.environ.get('MINDEX_CHECK_PROFILE', 'full')
    if profile == 'full':
        return profile, SMOKES, NODE_TESTS
    if profile != 'css':
        raise ValueError('Unknown check profile')
    import json
    try:
        smokes = json.loads(os.environ['MINDEX_CHECK_SMOKES'])
        if (not isinstance(smokes, list) or not smokes
            or not all(isinstance(name, str) for name in smokes)
            or len(smokes) != len(set(smokes)) or not set(smokes) <= set(SMOKES)):
            raise ValueError('Invalid CSS screen selection')
    except (KeyError, TypeError, json.JSONDecodeError) as error:
        raise ValueError('Invalid CSS screen selection') from error
    return profile, tuple(smokes), CSS_NODE_TESTS


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    args = parser.parse_args()
    try:
        profile, smokes, node_tests = scope_parameters()
        selected = selected_tests(args.shard_index, args.shard_count, smokes=smokes, node_tests=node_tests)
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
    print(f"PASS {profile} {label}: {len(selected)} entry points in {time.monotonic() - started:.1f}s")
    print("Not covered: full regression suite, production DB, original corpus, physical output, signed desktop packages.")

if __name__ == "__main__":
    main()
