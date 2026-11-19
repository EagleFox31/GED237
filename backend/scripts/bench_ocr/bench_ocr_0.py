"""OCR-0 benchmark: Tesseract (fast/best) vs EasyOCR vs RapidOCR, measured engine by engine.

Standalone measurement tool (gestion-projet/innovateur/protocole-ocr-0.md, DEC-2026-003). It is not
imported by the application. Run it inside the bench image (backend/Dockerfile.bench), one capped
container per engine, so that the cgroup memory peak belongs to that engine alone.

Subcommands:
    prepare  PDFs -> ground truth per page (pdftotext), clean renders (pdftoppm) and degraded copies
    run      one engine over one or more image folders -> one CSV row per image, a JSON meta line
    table    CSV + meta files -> the result table of the protocol (section 5), in Markdown

Example (inside the bench container):
    python -I scripts/bench_ocr_0.py prepare --pdf-dir /bench/pdf --out /bench/work
    python -I scripts/bench_ocr_0.py run --engine rapidocr --lot "A propre=/bench/work/clean" \
        --lot "A dégradé=/bench/work/degraded" --truth /bench/work/truth --out /bench/results
    python -I scripts/bench_ocr_0.py table --results /bench/results
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import re
import statistics
import subprocess  # nosec B404  # fixed argv to poppler tools, no shell
import sys
import time
import unicodedata
from pathlib import Path
from typing import Callable

ENGINES = ("t-fast", "t-best", "easyocr", "rapidocr")
LABELS = {"t-fast": "T-fast", "t-best": "T-best", "easyocr": "E", "rapidocr": "R"}
CSV_FIELDS = [
    "engine",
    "lot",
    "image",
    "seconds",
    "cer",
    "wer",
    "truth_chars",
    "hyp_chars",
]
TESSDATA_BEST = os.environ.get("BENCH_TESSDATA_BEST", "/opt/tessdata_best")
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg"}
# Lots de photos réelles (dossier local hors dépôt) : leurs noms de fichier ne sont jamais écrits.
PRIVATE_LOTS = ("B", "photo")
PRIVATE_LOT_PREFIXES = ("real", "photo-whatsapp", "photo-reel")


def report_name(lot: str, path: Path) -> str:
    """Nom à écrire dans les rapports : anonymisé pour un lot privé (règle photos réelles)."""
    if lot not in PRIVATE_LOTS and not lot.startswith(PRIVATE_LOT_PREFIXES):
        return path.name
    siblings = sorted(
        p for p in path.parent.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES
    )
    return f"{lot}-{siblings.index(path) + 1:02d}"


# Degradation of lot A (protocol section 1). Fixed values: changing one changes every result.
DPI = 200
ROTATION_DEG = 2.0
BLUR_RADIUS = 0.6
NOISE_SIGMA = 8.0
JPEG_QUALITY = 55
PHOTOCOPY_EVERY = 5  # 4 pages out of 20 rendered as thresholded greyscale
PHOTOCOPY_THRESHOLD = 160


# ── text metrics ─────────────────────────────────────────────────────────────
def normalize(text: str) -> str:
    """Same normalisation on both sides: NFKC, lowercase, any whitespace run -> one space. Accents kept."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text).lower()).strip()


def error_rates(truth: str, hyp: str) -> tuple[float, float]:
    import jiwer

    truth, hyp = normalize(truth), normalize(hyp)
    if not truth:
        raise ValueError("empty ground truth")
    if not hyp:
        # An engine that returns nothing failed on the page: keep it as a full error (protocol section 7).
        return 1.0, 1.0
    return float(jiwer.cer(truth, hyp)), float(jiwer.wer(truth, hyp))


# ── prepare ──────────────────────────────────────────────────────────────────
def _pages(pdf: Path) -> int:
    info = subprocess.run(  # nosec B603 B607
        ["pdfinfo", str(pdf)], check=True, capture_output=True, text=True
    ).stdout
    return int(re.search(r"^Pages:\s+(\d+)", info, re.M).group(1))


def _degrade(src: Path, dst: Path, rng: random.Random, photocopy: bool) -> None:
    import numpy as np
    from PIL import Image, ImageFilter

    img = Image.open(src).convert("RGB")
    img = img.rotate(
        rng.uniform(-ROTATION_DEG, ROTATION_DEG), expand=True, fillcolor="white"
    )
    img = img.filter(ImageFilter.GaussianBlur(BLUR_RADIUS))
    noise = np.random.default_rng(rng.randrange(2**32)).normal(
        0, NOISE_SIGMA, (img.height, img.width, 1)
    )
    img = Image.fromarray(
        np.clip(np.asarray(img, dtype=np.float32) + noise, 0, 255).astype("uint8")
    )
    if photocopy:
        img = (
            img.convert("L")
            .point(lambda v: 255 if v > PHOTOCOPY_THRESHOLD else 0)
            .convert("RGB")
        )
    img.save(dst, "JPEG", quality=JPEG_QUALITY)


def prepare(pdf_dir: Path, out: Path, seed: int, limit: int | None) -> None:
    truth_dir, clean_dir, degraded_dir = (
        out / "truth",
        out / "clean",
        out / "degraded",
    )
    for folder in (truth_dir, clean_dir, degraded_dir):
        folder.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)  # nosec B311  # reproducible degradation, not security
    pdfs = sorted(pdf_dir.glob("*.pdf"))[:limit]
    if not pdfs:
        sys.exit(f"no PDF in {pdf_dir}")
    index = 0
    for pdf in pdfs:
        for page in range(1, _pages(pdf) + 1):
            name = f"{pdf.stem}-p{page}"
            truth = subprocess.run(  # nosec B603 B607
                [
                    "pdftotext",
                    "-layout",
                    "-f",
                    str(page),
                    "-l",
                    str(page),
                    str(pdf),
                    "-",
                ],
                check=True,
                capture_output=True,
                text=True,
            ).stdout
            if not normalize(truth):
                print(
                    f"skip {name}: no text layer, ground truth must be supplied by hand",
                    file=sys.stderr,
                )
                continue
            (truth_dir / f"{name}.txt").write_text(truth, encoding="utf-8")
            subprocess.run(  # nosec B603 B607
                [
                    "pdftoppm",
                    "-r",
                    str(DPI),
                    "-f",
                    str(page),
                    "-l",
                    str(page),
                    "-singlefile",
                    "-png",
                    str(pdf),
                    str(clean_dir / name),
                ],
                check=True,
            )
            _degrade(
                clean_dir / f"{name}.png",
                degraded_dir / f"{name}.jpg",
                rng,
                photocopy=index % PHOTOCOPY_EVERY == PHOTOCOPY_EVERY - 1,
            )
            index += 1
    print(
        f"prepared {index} pages from {len(pdfs)} PDF(s) into {out} (seed {seed}, {DPI} dpi)"
    )


# ── engines ──────────────────────────────────────────────────────────────────
def _tesseract(best: bool) -> tuple[Callable, dict]:
    import pytesseract

    config = "--psm 3"  # same as production (tesseract_engine.py)
    if best:
        # Separate tessdata folder: copying tessdata_best over the default one would turn T-fast into T-best.
        config = f"--oem 1 --psm 3 --tessdata-dir {TESSDATA_BEST}"
    version = str(pytesseract.get_tesseract_version())
    return (
        lambda img: pytesseract.image_to_string(img, lang="fra+eng", config=config)
    ), {
        "model": f"tesseract {version} fra+eng {'tessdata_best' if best else 'tessdata (image)'}",
        "config": config,
    }


def _easyocr(threads: int | None = None) -> tuple[Callable, dict]:
    import easyocr
    import numpy as np
    import torch

    if threads:
        torch.set_num_threads(threads)
    reader = easyocr.Reader(["fr", "en"], gpu=False, verbose=False)
    return (
        lambda img: "\n".join(
            reader.readtext(np.asarray(img), detail=0, paragraph=True)
        )
    ), {
        "model": f"easyocr {easyocr.__version__} ['fr','en'] CPU",
        "config": "readtext(detail=0, paragraph=True)",
    }


def _rapidocr(threads: int | None = None) -> tuple[Callable, dict]:
    import numpy as np
    from rapidocr import EngineType, LangDet, LangRec, ModelType, OCRVersion, RapidOCR

    # PP-OCRv6 small, ONNX Runtime. In v6 the recognition model is multilingual (fr included) and
    # lang_type does not change it; only model_type does (RapidOCR docs, model list).
    params = {
        "Det.engine_type": EngineType.ONNXRUNTIME,
        "Det.lang_type": LangDet.CH,
        "Det.model_type": ModelType.SMALL,
        "Det.ocr_version": OCRVersion.PPOCRV6,
        "Rec.engine_type": EngineType.ONNXRUNTIME,
        "Rec.lang_type": LangRec.CH,
        "Rec.model_type": ModelType.SMALL,
        "Rec.ocr_version": OCRVersion.PPOCRV6,
    }
    if threads:
        params["EngineConfig.onnxruntime.intra_op_num_threads"] = threads
        params["EngineConfig.onnxruntime.inter_op_num_threads"] = 1
    engine = RapidOCR(params=params)

    def call(img):
        result = engine(np.asarray(img)[:, :, ::-1])  # RapidOCR expects BGR like OpenCV
        return "\n".join(result.txts or ())

    from importlib.metadata import version

    return call, {
        "model": f"rapidocr {version('rapidocr')} PP-OCRv6 small det+rec, onnxruntime {version('onnxruntime')}",
        "config": json.dumps(
            {k: str(getattr(v, "value", v)) for k, v in params.items()}
        ),
    }


def load_engine(code: str, threads: int | None = None) -> tuple[Callable, dict]:
    if code in ("t-fast", "t-best"):
        return _tesseract(best=code == "t-best")
    return _easyocr(threads) if code == "easyocr" else _rapidocr(threads)


# ── measurement helpers ──────────────────────────────────────────────────────
def cpu_limit() -> int:
    """CPUs granted to this container (cgroup v2 cpu.max), else the visible count.

    Engines size their thread pools from the host's cores (16 on the dev VM) while --cpus=2 grants two:
    the oversubscribed pool is throttled by the quota and inflates the time per page.
    """
    try:
        quota, period = Path("/sys/fs/cgroup/cpu.max").read_text().split()
        if quota != "max":
            return max(1, -(-int(quota) // int(period)))
    except (OSError, ValueError):
        pass
    return os.cpu_count() or 1


def memory_peak_mb() -> float | None:
    """Peak memory of this container (cgroup v2, else v1). None when neither is readable."""
    for path in (
        "/sys/fs/cgroup/memory.peak",
        "/sys/fs/cgroup/memory/memory.max_usage_in_bytes",
    ):
        try:
            return int(Path(path).read_text().split()[0]) / 2**20
        except (OSError, ValueError, IndexError):
            continue
    return None


def _dir_mb(path: Path) -> float:
    return (
        sum(f.stat().st_size for f in path.rglob("*") if f.is_file()) / 2**20
        if path.exists()
        else 0.0
    )


def installed_mb(code: str) -> float:
    """Disk footprint of what the engine needs on top of the base image: packages and models."""
    import importlib.util

    def package(name: str) -> Path:
        spec = importlib.util.find_spec(name)
        return (
            Path(spec.origin).parent if spec and spec.origin else Path("/nonexistent")
        )

    if code == "t-fast":
        return _dir_mb(Path("/usr/share/tesseract-ocr"))
    if code == "t-best":
        return _dir_mb(Path(TESSDATA_BEST))
    if code == "easyocr":
        return sum(
            _dir_mb(p)
            for p in (
                package("torch"),
                package("torchvision"),
                package("easyocr"),
                Path.home() / ".EasyOCR",
            )
        )
    return sum(_dir_mb(p) for p in (package("rapidocr"), package("onnxruntime")))


# ── run ──────────────────────────────────────────────────────────────────────
def run(code: str, lots: list[tuple[str, Path]], truth_dir: Path, out: Path) -> None:
    from PIL import Image

    out.mkdir(parents=True, exist_ok=True)
    threads = cpu_limit()
    # Before any engine import: OpenMP (Tesseract, torch) sizes its pool from the env at start-up.
    os.environ["OMP_NUM_THREADS"] = os.environ["OMP_THREAD_LIMIT"] = str(threads)
    started = time.perf_counter()
    ocr, meta = load_engine(code, threads)
    meta.update(
        engine=code, threads=threads, startup_s=round(time.perf_counter() - started, 3)
    )
    print(f"{code}: loaded in {meta['startup_s']} s, {threads} thread(s)", flush=True)

    csv_path = out / f"bench_ocr_0_{code}.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        handle.flush()  # rows are flushed one by one: an OOM kill keeps what was measured
        for lot, folder in lots:
            images = sorted(
                p for p in folder.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES
            )
            if not images:
                sys.exit(f"lot {lot!r}: no image in {folder}")
            for image in images:
                truth = (truth_dir / f"{image.stem}.txt").read_text(encoding="utf-8")
                img = Image.open(image).convert(
                    "RGB"
                )  # decoding stays outside the timed call
                t0 = time.perf_counter()
                hyp = ocr(img)
                seconds = time.perf_counter() - t0
                cer, wer = error_rates(truth, hyp)
                writer.writerow(
                    {
                        "engine": code,
                        "lot": lot,
                        "image": report_name(lot, image),
                        "seconds": round(seconds, 4),
                        "cer": round(cer, 5),
                        "wer": round(wer, 5),
                        "truth_chars": len(normalize(truth)),
                        "hyp_chars": len(normalize(hyp)),
                    }
                )
                handle.flush()
                print(
                    f"{code} {lot} {report_name(lot, image)}: {seconds:.2f}s CER {cer:.3f}",
                    flush=True,
                )

    peak = memory_peak_mb()
    meta.update(
        peak_mb=round(peak, 1) if peak is not None else None,
        installed_mb=round(installed_mb(code), 1),
    )
    (out / f"bench_ocr_0_{code}.meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2)
    )
    print(json.dumps(meta, ensure_ascii=False))


# ── table ────────────────────────────────────────────────────────────────────
def _p95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, round(0.95 * len(ordered)) - 1))]


def table(results: Path) -> str:
    """Markdown table of protocol section 5, one row per engine and lot; a killed engine keeps one row."""
    head = (
        "| Config | Lot | Pages | CER moy. | CER méd. | WER | s/page moy. | s/page P95 | Démarrage (s) "
        "| Pic RAM (Mo) | OOM | Taille (Mo) |"
    )
    lines = [head, "|" + "---|" * 12]
    # Written by bench_ocr_0.sh: "<engine>: exit <code>" for each container that did not exit 0.
    exits_path = results / "exit_codes.txt"
    exits = dict(
        re.findall(r"^(\S+): exit (\d+)", exits_path.read_text(), re.M)
        if exits_path.exists()
        else []
    )
    for code in ENGINES:
        csv_path = results / f"bench_ocr_0_{code}.csv"
        if not csv_path.exists():
            continue
        meta_path = results / f"bench_ocr_0_{code}.meta.json"
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        rows = list(csv.DictReader(csv_path.open(encoding="utf-8")))
        label = LABELS[code] + (f" ({meta['model']})" if meta.get("model") else "")
        if code in exits:
            # Killed before the end: keep a row, the failure is a result (137 = cgroup OOM killer).
            oom = "oui" if exits[code] == "137" else f"exit {exits[code]}"
            lines.append(
                f"| {label} | pages mesurées avant l'arrêt : {len(rows)} | — | — | — | — | — | — "
                f"| — | ≥ plafond | {oom} | — |"
            )
            continue
        for lot in dict.fromkeys(r["lot"] for r in rows):
            sel = [r for r in rows if r["lot"] == lot]
            cer = [float(r["cer"]) * 100 for r in sel]
            wer = [float(r["wer"]) * 100 for r in sel]
            sec = [float(r["seconds"]) for r in sel]
            lines.append(
                f"| {label} | {lot} | {len(sel)} | {statistics.mean(cer):.1f} % | {statistics.median(cer):.1f} % "
                f"| {statistics.mean(wer):.1f} % | {statistics.mean(sec):.2f} | {_p95(sec):.2f} "
                f"| {meta.get('startup_s', '—')} | {meta.get('peak_mb') or '—'} "
                f"| non | {meta.get('installed_mb', '—')} |"
            )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser(
        "prepare", help="ground truth, clean and degraded renders from PDFs"
    )
    p.add_argument("--pdf-dir", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--seed", type=int, default=237)
    p.add_argument(
        "--limit", type=int, default=None, help="first N PDFs (sorted by name)"
    )

    r = sub.add_parser("run", help="measure one engine")
    r.add_argument("--engine", choices=ENGINES, required=True)
    r.add_argument("--lot", action="append", required=True, metavar="NAME=DIR")
    r.add_argument("--truth", type=Path, required=True)
    r.add_argument("--out", type=Path, required=True)

    t = sub.add_parser("table", help="Markdown result table")
    t.add_argument("--results", type=Path, required=True)

    args = parser.parse_args()
    if args.command == "prepare":
        prepare(args.pdf_dir, args.out, args.seed, args.limit)
    elif args.command == "run":
        lots = [
            (name, Path(folder))
            for name, _, folder in (item.partition("=") for item in args.lot)
        ]
        run(args.engine, lots, args.truth, args.out)
    else:
        print(table(args.results))


if __name__ == "__main__":
    main()
