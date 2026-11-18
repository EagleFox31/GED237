"""Rappel + pic RAM via le vrai RapidOCREngine de l'image de la PR (reglages par defaut de l'image)."""

import sys, csv, re, time, unicodedata, collections, resource
from pathlib import Path

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/scripts")
import bench_ocr_0 as b
from app.core.config import settings
from app.services.ocr.rapidocr_engine import RapidOCREngine


def norm(t):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", t).lower()).strip()


print(
    "MAX_SIDE",
    settings.OCR_RAPIDOCR_MAX_SIDE,
    "MODEL_DIR",
    settings.RAPIDOCR_MODEL_DIR,
    flush=True,
)
eng = RapidOCREngine()
out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
with (out / "real.csv").open("w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["lot", "image", "s", "recall", "precision", "hyp", "truth", "engine"])
    for lot in sys.argv[2].split(","):
        for p in sorted(Path(f"/bench/{lot}").iterdir()):
            tw = norm(
                Path(f"/bench/truth/{p.stem}.txt").read_text(encoding="utf-8")
            ).split()
            t = time.perf_counter()
            r = eng.extract_from_image(str(p))
            s = time.perf_counter() - t
            hw = norm(r.text).split()
            hit = sum((collections.Counter(tw) & collections.Counter(hw)).values())
            w.writerow(
                [
                    lot,
                    b.report_name(lot, p),
                    round(s, 2),
                    round(hit / max(1, len(tw)), 4),
                    round(hit / max(1, len(hw)), 4),
                    len(hw),
                    len(tw),
                    r.engine_name if hasattr(r, "engine_name") else "",
                ]
            )
            fh.flush()
print("rss_mb", resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024)
print("cgroup_peak_mb", int(Path("/sys/fs/cgroup/memory.peak").read_text()) / 2**20)
