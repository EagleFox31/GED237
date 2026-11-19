"""Bench OCR v2 : variantes Tesseract (psm) et RapidOCR (version/modele, reduction d'image). Un variant par conteneur."""

import sys, csv, time, collections, resource

sys.path.insert(0, "/app/scripts")
import bench_ocr_0 as b
import jiwer
from pathlib import Path
from PIL import Image

variant, maxside = sys.argv[1], int(sys.argv[2])  # maxside 0 = pas de reduction
out = Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
lots = sys.argv[4].split(",")


def tess(psm):
    import pytesseract

    return lambda img: pytesseract.image_to_string(
        img, lang="fra+eng", config=f"--psm {psm}"
    )


def rapid(version, lang, mtype):
    import numpy as np
    from rapidocr import EngineType, LangDet, LangRec, ModelType, OCRVersion, RapidOCR

    p = {
        "Det.engine_type": EngineType.ONNXRUNTIME,
        "Det.lang_type": LangDet.CH,
        "Det.model_type": getattr(ModelType, mtype),
        "Det.ocr_version": getattr(OCRVersion, version),
        "Rec.engine_type": EngineType.ONNXRUNTIME,
        "Rec.lang_type": getattr(LangRec, lang),
        "Rec.model_type": getattr(ModelType, mtype),
        "Rec.ocr_version": getattr(OCRVersion, version),
        "EngineConfig.onnxruntime.intra_op_num_threads": 1,
        "EngineConfig.onnxruntime.inter_op_num_threads": 1,
    }
    eng = RapidOCR(params=p)
    return lambda img: "\n".join(eng(np.asarray(img)[:, :, ::-1]).txts or ())


ENG = {
    "tfast-psm3": lambda: tess(3),
    "tfast-psm6": lambda: tess(6),
    "tfast-psm11": lambda: tess(11),
    "rapid-v6-small": lambda: rapid("PPOCRV6", "CH", "SMALL"),
    "rapid-v5-latin-mobile": lambda: rapid("PPOCRV5", "LATIN", "MOBILE"),
}


def peak_cgroup_mb():
    for f in ("/sys/fs/cgroup/memory.peak",):
        try:
            return int(Path(f).read_text()) / 2**20
        except Exception:
            return None


t0 = time.perf_counter()
ocr = ENG[variant]()
startup = time.perf_counter() - t0
print(f"{variant} maxside={maxside} startup={startup:.2f}s", flush=True)
path = out / f"{variant}_{maxside}.csv"
with path.open("w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(
        [
            "variant",
            "maxside",
            "lot",
            "image",
            "s",
            "cer_ordered",
            "cer_sorted",
            "recall",
            "precision",
            "hyp_words",
            "truth_words",
        ]
    )
    fh.flush()
    for lot in lots:
        for p in sorted(Path(f"/bench/{lot}").iterdir()):
            truth = b.normalize(
                Path(f"/bench/truth/{p.stem}.txt").read_text(encoding="utf-8")
            )
            img = Image.open(p).convert("RGB")
            if maxside and max(img.size) > maxside:
                img.thumbnail((maxside, maxside), Image.LANCZOS)
            t = time.perf_counter()
            hyp = b.normalize(ocr(img))
            s = time.perf_counter() - t
            tw, hw = truth.split(), hyp.split()
            co = jiwer.cer(truth, hyp) if hyp else 1.0
            cs = jiwer.cer(" ".join(sorted(tw)), " ".join(sorted(hw))) if hw else 1.0
            hit = sum((collections.Counter(tw) & collections.Counter(hw)).values())
            w.writerow(
                [
                    variant,
                    maxside,
                    lot,
                    b.report_name(lot, p),
                    round(s, 2),
                    round(co, 4),
                    round(cs, 4),
                    round(hit / max(1, len(tw)), 4),
                    round(hit / max(1, len(hw)), 4),
                    len(hw),
                    len(tw),
                ]
            )
            fh.flush()
            print(
                variant,
                lot,
                b.report_name(lot, p),
                f"{s:.1f}s",
                f"cerS={cs:.3f}",
                flush=True,
            )
rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
(out / f"{variant}_{maxside}.peak").write_text(
    f"rss_mb={rss:.0f} cgroup_peak_mb={peak_cgroup_mb()} startup_s={startup:.2f}\n"
)
