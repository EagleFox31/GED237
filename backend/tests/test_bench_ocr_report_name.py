"""bench_ocr_0.report_name : un lot de photos réelles n'écrit jamais le nom de fichier."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "bench_ocr"))

import bench_ocr_0 as bench  # noqa: E402


def _lot(tmp_path, names):
    for name in names:
        (tmp_path / name).write_bytes(b"x")
    return [tmp_path / n for n in sorted(names)]


def test_private_lots_never_expose_file_names(tmp_path):
    files = _lot(tmp_path, ["IMG-0001.jpg", "IMG-0002.jpg"])
    for lot in ("B", "photo", "real-1", "photo-whatsapp", "photo-reel-2"):
        names = [bench.report_name(lot, f) for f in files]
        assert names == [f"{lot}-01", f"{lot}-02"]
        assert not any("IMG-000" in n for n in names)


def test_public_lots_keep_file_names(tmp_path):
    (path,) = _lot(tmp_path, ["synth-photo-dbd-01.png"])
    for lot in ("propre", "bruite", "photo-synth", "funsd-en"):
        assert bench.report_name(lot, path) == "synth-photo-dbd-01.png"
