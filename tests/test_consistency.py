"""Guards that keep the package easy to maintain."""

import json
from pathlib import Path
import re

ROOT = Path(__file__).parents[1] / "custom_components" / "ai_coach"
CARD = ROOT / "frontend" / "ai-coach-card.js"


def _keys(node, prefix=""):
    if isinstance(node, dict):
        for key, value in node.items():
            yield from _keys(value, f"{prefix}.{key}")
    else:
        yield prefix


def test_integration_translations_have_same_keys() -> None:
    en = json.loads((ROOT / "translations" / "en.json").read_text())
    it = json.loads((ROOT / "translations" / "it.json").read_text())
    assert set(_keys(en)) == set(_keys(it))


def test_every_entity_has_a_name_and_an_icon() -> None:
    en = json.loads((ROOT / "translations" / "en.json").read_text())["entity"]
    icons = json.loads((ROOT / "icons.json").read_text())["entity"]
    for platform, file in (("sensor", "sensor.py"), ("binary_sensor", "binary_sensor.py"), ("button", "button.py")):
        keys = set(re.findall(r'Description\(\s*key="(\w+)"', (ROOT / file).read_text()))
        assert keys, platform
        assert keys == set(en[platform]) == set(icons[platform]), platform


def test_card_knows_every_entity_role() -> None:
    card = CARD.read_text()
    roles = set(re.findall(r"(\w+): \"\w+\"", re.search(r"const ACC_SIBLINGS = \{(.*?)\};", card, re.S).group(1)))
    en = json.loads((ROOT / "translations" / "en.json").read_text())["entity"]
    assert roles == {key for platform in en.values() for key in platform}


def test_card_is_ascii() -> None:
    assert CARD.read_text().isascii()


def test_version_lives_only_in_the_manifest() -> None:
    version = json.loads((ROOT / "manifest.json").read_text())["version"]
    assert re.fullmatch(r"\d+\.\d+\.\d+", version)
    for path in [*ROOT.glob("*.py"), CARD]:
        assert version not in path.read_text(), f"hard-coded version in {path.name}"
