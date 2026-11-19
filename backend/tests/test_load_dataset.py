"""Load corpus generator (item 8): unique deterministic files, disk guard, idempotent rerun."""

import hashlib
import json
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND / "scripts"))

import load_dataset  # noqa: E402


def _tree(out: Path) -> dict[str, bytes]:
    return {
        str(p.relative_to(out)): p.read_bytes()
        for p in sorted(out.rglob("*"))
        if p.is_file()
    }


def test_plan_spreads_files_over_batches():
    assert load_dataset.plan(10, 3) == [4, 3, 3]
    assert load_dataset.plan(2, 5) == [1, 1]
    with pytest.raises(ValueError):
        load_dataset.plan(0, 1)


@pytest.mark.parametrize(
    "text, expected", [("4", (4, 4)), ("1-4", (1, 4)), ("70", (70, 70))]
)
def test_parse_size(text, expected):
    assert load_dataset.parse_size(text) == expected


@pytest.mark.parametrize("text", ["0", "4-1", "abc", "1-"])
def test_parse_size_refuses_bad_values(text):
    with pytest.raises(ValueError):
        load_dataset.parse_size(text)


def test_documents_are_deterministic_unique_pdf_in_size_range():
    docs = [load_dataset.document(i, 237, (1, 4)) for i in range(200)]
    assert docs == [load_dataset.document(i, 237, (1, 4)) for i in range(200)]
    names = {name for name, _ in docs}
    digests = {hashlib.sha256(content).hexdigest() for _, content in docs}
    assert len(names) == len(digests) == 200
    for name, content in docs:
        assert name.endswith(".pdf") and content.startswith(b"%PDF-1.4")
        # The size target is a floor; one round of lines may overshoot by ~1 line.
        assert 1024 <= len(content) <= 4 * 1024 + 256
    other_seed = {
        hashlib.sha256(load_dataset.document(i, 238, (1, 4))[1]).hexdigest()
        for i in range(200)
    }
    assert digests.isdisjoint(other_seed)


def test_large_size_reaches_target():
    _, content = load_dataset.document(0, 237, (70, 70))
    assert 70 * 1024 <= len(content) <= 71 * 1024


def test_generate_writes_batches_and_manifest(tmp_path):
    out = tmp_path / "corpus"
    code = load_dataset.main(
        ["--out", str(out), "--files", "25", "--batches", "3", "--size-kb", "2"]
    )
    assert code == 0
    manifest = json.loads(
        (out / load_dataset.MANIFEST_NAME).read_text(encoding="utf-8")
    )
    assert manifest["files"] == 25
    assert manifest["batch_sizes"] == [9, 8, 8]
    assert manifest["params"] == {
        "files": 25,
        "size_kb": [2, 2],
        "batches": 3,
        "seed": 237,
    }
    for number, size in enumerate(manifest["batch_sizes"], start=1):
        assert len(list((out / f"batch_{number:04d}").iterdir())) == size
    assert manifest["bytes"] == sum(
        len(v) for k, v in _tree(out).items() if k.endswith(".pdf")
    )


def test_same_parameters_write_nothing(tmp_path, capsys):
    out = tmp_path / "corpus"
    args = ["--out", str(out), "--files", "12", "--batches", "2", "--size-kb", "1-2"]
    assert load_dataset.main(args) == 0
    before = {p: p.stat().st_mtime_ns for p in out.rglob("*")}
    capsys.readouterr()
    assert load_dataset.main(args) == 0
    assert "nothing written" in capsys.readouterr().out
    assert {p: p.stat().st_mtime_ns for p in out.rglob("*")} == before


def test_other_parameters_need_force_and_keep_foreign_files(tmp_path):
    out = tmp_path / "corpus"
    assert load_dataset.main(["--out", str(out), "--files", "6", "--batches", "2"]) == 0
    foreign = out / "notes.txt"
    foreign.write_text("not ours", encoding="utf-8")
    assert load_dataset.main(["--out", str(out), "--files", "4", "--batches", "2"]) == 1
    assert (
        load_dataset.main(
            ["--out", str(out), "--files", "4", "--batches", "2", "--force"]
        )
        == 0
    )
    pdfs = [p for p in out.rglob("*.pdf")]
    assert len(pdfs) == 4
    assert foreign.read_text(encoding="utf-8") == "not ours"


def test_disk_guard_refuses_before_writing(tmp_path, capsys):
    out = tmp_path / "corpus"
    code = load_dataset.main(
        ["--out", str(out), "--files", "1000", "--size-kb", "4", "--max-total-mb", "1"]
    )
    assert code == 2
    assert "--max-total-mb" in capsys.readouterr().out
    assert not out.exists()


def test_disk_guard_keeps_free_space(tmp_path, capsys, monkeypatch):
    class Usage:
        free = 3 * 2**30

    monkeypatch.setattr(load_dataset.shutil, "disk_usage", lambda _path: Usage)
    out = tmp_path / "corpus"
    assert load_dataset.main(["--out", str(out), "--files", "10"]) == 2
    assert "--keep-free-gb" in capsys.readouterr().out
    assert not out.exists()


def test_default_run_stays_far_below_seven_gigabytes():
    sample = max(len(load_dataset.document(i, 237, (1, 4))[1]) for i in range(20))
    assert sample * 100_000 < 1024 * 2**20
