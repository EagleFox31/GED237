"""Bench OCR v3 : vote multi-moteurs. Tess fast psm3 + RapidOCR v5 latin (2000 px) [+ Tess best]. Sequentiel, un conteneur."""

import sys, csv, time, collections, resource, difflib

sys.path.insert(0, "/app/scripts")
import bench_ocr_0 as b
import jiwer, numpy as np, pytesseract
from pathlib import Path
from PIL import Image
from rapidocr import EngineType, LangDet, LangRec, ModelType, OCRVersion, RapidOCR

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
lots = sys.argv[2].split(",")
MAXSIDE = 2000
p = {
    "Det.engine_type": EngineType.ONNXRUNTIME,
    "Det.lang_type": LangDet.CH,
    "Det.model_type": ModelType.MOBILE,
    "Det.ocr_version": OCRVersion.PPOCRV5,
    "Rec.engine_type": EngineType.ONNXRUNTIME,
    "Rec.lang_type": LangRec.LATIN,
    "Rec.model_type": ModelType.MOBILE,
    "Rec.ocr_version": OCRVersion.PPOCRV5,
    "EngineConfig.onnxruntime.intra_op_num_threads": 1,
    "EngineConfig.onnxruntime.inter_op_num_threads": 1,
}
rapid = RapidOCR(params=p)


def tess_words(img, best=False):
    cfg = "--psm 3" + (" --tessdata-dir /opt/tessdata_best" if best else "")
    d = pytesseract.image_to_data(
        img, lang="fra+eng", config=cfg, output_type=pytesseract.Output.DICT
    )
    return [
        (w, float(c))
        for w, c in zip(d["text"], d["conf"])
        if w.strip() and float(c) >= 0
    ]


def rapid_words(img):
    r = rapid(np.asarray(img)[:, :, ::-1])
    res = []
    for t, s in zip(r.txts or (), r.scores or ()):
        res += [(w, float(s) * 100) for w in t.split()]
    return res


def mean_conf(ws):
    return sum(c for _, c in ws) / len(ws) if ws else 0.0


def key(w):
    return b.normalize(w)


def vote_a(t, r):
    return t if mean_conf(t) >= mean_conf(r) else r


def vote_b(t, r):
    sm = difflib.SequenceMatcher(
        None, [key(w) for w, _ in t], [key(w) for w, _ in r], autojunk=False
    )
    res = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        T, R = t[i1:i2], r[j1:j2]
        if op == "equal":
            res += T
        elif op == "delete":
            res += [x for x in T if x[1] >= 60]
        elif op == "insert":
            res += [x for x in R if x[1] >= 60]
        elif len(T) == len(R):
            res += [
                x if x[1] >= y[1] else y for x, y in zip(T, R)
            ]  # egalite : Tesseract
        else:
            res += T if mean_conf(T) >= mean_conf(R) else R
    return res


def vote_c(t, r, tb):
    cand = [collections.defaultdict(list) for _ in t]
    for other in (r, tb):
        sm = difflib.SequenceMatcher(
            None, [key(w) for w, _ in t], [key(w) for w, _ in other], autojunk=False
        )
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == "equal" or (op == "replace" and i2 - i1 == j2 - j1):
                for k in range(i2 - i1):
                    cand[i1 + k][key(other[j1 + k][0])].append(other[j1 + k])
    res = []
    for k, (w, c) in enumerate(t):
        votes = collections.Counter({key(w): 1})
        best = {key(w): (w, c)}
        for kw, lst in cand[k].items():
            votes[kw] += len(lst)
            best[kw] = max(lst + ([best[kw]] if kw in best else []), key=lambda x: x[1])
        top = max(votes.values())
        wins = [kw for kw, n in votes.items() if n == top]
        pick = key(w) if key(w) in wins else max(wins, key=lambda kw: best[kw][1])
        res.append(best[pick])
    return res


def peak():
    try:
        return int(Path("/sys/fs/cgroup/memory.peak").read_text()) / 2**20
    except Exception:
        return None


W = ["tess", "rapid", "best", "A", "B", "C"]
fh = (out / "vote.csv").open("w", newline="")
w = csv.writer(fh)
w.writerow(
    [
        "variant",
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
    for pth in sorted(Path(f"/bench/{lot}").iterdir()):
        truth = b.normalize(
            Path(f"/bench/truth/{pth.stem}.txt").read_text(encoding="utf-8")
        )
        img = Image.open(pth).convert("RGB")
        if max(img.size) > MAXSIDE:
            img.thumbnail((MAXSIDE, MAXSIDE), Image.LANCZOS)
        t0 = time.perf_counter()
        T = tess_words(img)
        st = time.perf_counter() - t0
        t0 = time.perf_counter()
        R = rapid_words(img)
        sr = time.perf_counter() - t0
        t0 = time.perf_counter()
        TB = tess_words(img, best=True)
        sb = time.perf_counter() - t0
        outs = {
            "tess": (T, st),
            "rapid": (R, sr),
            "best": (TB, sb),
            "A": (vote_a(T, R), st + sr),
            "B": (vote_b(T, R), st + sr),
            "C": (vote_c(T, R, TB), st + sr + sb),
        }
        tw = truth.split()
        for v in W:
            ws, s = outs[v]
            hyp = b.normalize(" ".join(x for x, _ in ws))
            hw = hyp.split()
            co = jiwer.cer(truth, hyp) if hyp else 1.0
            cs = jiwer.cer(" ".join(sorted(tw)), " ".join(sorted(hw))) if hw else 1.0
            hit = sum((collections.Counter(tw) & collections.Counter(hw)).values())
            w.writerow(
                [
                    v,
                    lot,
                    b.report_name(lot, pth),
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
            lot,
            b.report_name(lot, pth),
            f"tess {st:.1f}s rapid {sr:.1f}s best {sb:.1f}s",
            flush=True,
        )
(out / "vote.peak").write_text(
    f"rss_mb={resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024:.0f} cgroup_peak_mb={peak()}\n"
)
