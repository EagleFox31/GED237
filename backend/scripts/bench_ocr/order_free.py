import sys, csv, time, collections

sys.path.insert(0, "/app/scripts")
import bench_ocr_0 as b
import pytesseract, jiwer
from pathlib import Path
from PIL import Image

cfgs = {
    "t-fast-psm6": dict(config="--psm 6"),
    "t-fast-psm3": dict(config="--psm 3"),
    "t-best-psm3": dict(config="--oem 1 --psm 3 --tessdata-dir /opt/tessdata_best"),
}
only = sys.argv[1]
cfg = cfgs[only]
rows = []
for lot in ("propre", "bruite", "photo", "funsd-en"):
    for p in sorted(Path(f"/bench/{lot}").iterdir()):
        truth = b.normalize(
            Path(f"/bench/truth/{p.stem}.txt").read_text(encoding="utf-8")
        )
        img = Image.open(p).convert("RGB")
        t0 = time.perf_counter()
        hyp = b.normalize(
            pytesseract.image_to_string(img, lang="fra+eng", config=cfg["config"])
        )
        s = time.perf_counter() - t0
        tw, hw = truth.split(), hyp.split()
        cer_o = jiwer.cer(truth, hyp) if hyp else 1.0
        cer_s = jiwer.cer(" ".join(sorted(tw)), " ".join(sorted(hw))) if hw else 1.0
        tc, hc = collections.Counter(tw), collections.Counter(hw)
        hit = sum((tc & hc).values())
        rows.append(
            (
                only,
                lot,
                b.report_name(lot, p),
                round(s, 2),
                round(cer_o, 4),
                round(cer_s, 4),
                round(hit / max(1, len(tw)), 4),
                round(hit / max(1, len(hw)), 4),
            )
        )
        print(rows[-1], flush=True)
with open(f"/bench/results3/{only}.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(
        ["cfg", "lot", "image", "s", "cer_ordered", "cer_sorted", "recall", "precision"]
    )
    w.writerows(rows)
