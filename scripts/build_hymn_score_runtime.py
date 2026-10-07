"""Derive the browser's score index without changing the authoring manifest."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/hymn-scores/manifest.json"
SLIDE_FIELDS = frozenset((
    "src", "url", "name", "scoreFormLabel", "score_form_label", "formLabel",
    "form_label", "scoreFormKey", "score_form_key", "formKey", "form_key",
))


def runtime_manifest(source):
    return {number: {
        "title": entry.get("title", ""),
        "slides": [{key: value for key, value in slide.items() if key in SLIDE_FIELDS}
                   for slide in entry.get("slides", [])],
    } for number, entry in source.items()}


def build(source=SOURCE, check=False):
    source = Path(source)
    target = source.with_name(source.stem + ".runtime.json")
    original = json.loads(source.read_text(encoding="utf-8"))
    encoded = json.dumps(runtime_manifest(original), ensure_ascii=False, separators=(",", ":")) + "\n"
    if check:
        if not target.exists() or target.read_text(encoding="utf-8") != encoded:
            raise SystemExit("Score runtime index is stale; run scripts/build_hymn_score_runtime.py")
    else:
        target.write_text(encoded, encoding="utf-8")
    print(f"Score index: {len(original)} hymns; {source.stat().st_size} -> {len(encoded.encode('utf-8'))} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--source", type=Path, default=SOURCE)
    args = parser.parse_args()
    build(args.source, args.check)
