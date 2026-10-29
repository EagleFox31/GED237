"""Guard the coverage settings that the CI gate relies on.

coverage.py silently ignores sections it does not read (it never reads
pytest.ini), so a misplaced setting only shows up as a wrong percentage.
"""

from pathlib import Path

import coverage

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_coverage_settings_are_loaded(monkeypatch):
    monkeypatch.chdir(BACKEND_DIR)
    cov = coverage.Coverage()

    assert "greenlet" in cov.get_option("run:concurrency")
    assert "app/workers/*" in cov.get_option("run:omit")
    assert cov.get_option("report:fail_under") == 70
