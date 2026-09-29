import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text()
RELEASE = (ROOT / "mindex-release.json").read_text()


def test_bootstrap_never_exposes_the_browser_default_canvas():
    assert '<body class="ui-booting">' in INDEX
    assert "background: var(--mindex-boot-bg, #181816);" in INDEX
    assert "color-scheme: dark" in INDEX
    assert "body.ui-booting .app-shell" in INDEX
    fallback = re.search(r'const fallbackVersion = "([^"]+)";', INDEX)
    assert fallback
    assert fallback.group(1) == json.loads(RELEASE)["version"]


if __name__ == "__main__":
    test_bootstrap_never_exposes_the_browser_default_canvas()
    print("startup bootstrap: PASS")
