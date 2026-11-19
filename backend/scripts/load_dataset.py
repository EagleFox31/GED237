"""Generate a large synthetic corpus for the volume test (item 8, 100 000 documents).

    python scripts/load_dataset.py --out /data/ingest/load                       # 100 000 PDF, 1-4 KB
    python scripts/load_dataset.py --out /data/ingest/witness --files 1000 --size-kb 70 --batches 1

Writes ``<out>/batch_0001/ … batch_NNNN/`` (one folder per import batch) and ``<out>/load-manifest.json``.
Every file is a one-page text PDF built with the writer of ``demo_dataset.py``: a business
phrase of the demo corpus (so classification rules still fire), a unit, a year and a unique
reference. Contents are all different (the import refuses exact duplicates) and are a pure function of
the parameters: a second run with the same parameters finds the manifest and writes nothing.

Disk guard (the test machine is short on disk): the run is refused, before writing anything, when
the estimated size exceeds ``--max-total-mb`` (default 1024) or would leave less than
``--keep-free-gb`` (default 5) on the target disk. The defaults (protocol of item 8) write
100 000 text PDF of 1 to 4 KB, about 250 MB. No image: each one would go through OCR.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from demo_dataset import FOLDERS, PHRASES, UNIT, YEARS, pdf_text  # noqa: E402

GENERATOR = "backend/scripts/load_dataset.py"
MANIFEST_NAME = "load-manifest.json"
BATCH_PREFIX = "batch_"
# Families without keyword stay unclassified on purpose, as in the demo corpus.
FAMILIES = sorted(PHRASES)
FILLER = (
    "dossier piece justificative reference service courrier arrivee depart visa "
    "signature archive registre instruction transmission bordereau copie conforme"
).split()
# One page holds about 45 lines of 11 pt: beyond, extra lines are counted in the size
# but fall below the page (the size target matters more than the layout here).
LINE_CHARS = 90


class DiskGuardError(RuntimeError):
    """The run would use too much disk; nothing has been written."""


def plan(files: int, batches: int) -> list[int]:
    """Number of files per batch: as even as possible, first batches take the remainder."""
    if files < 1 or batches < 1:
        raise ValueError("files and batches must be >= 1")
    batches = min(batches, files)
    base, extra = divmod(files, batches)
    return [base + (1 if index < extra else 0) for index in range(batches)]


def parse_size(text: str) -> tuple[int, int]:
    """``"4"`` -> (4, 4); ``"1-4"`` -> (1, 4). Sizes in KB, >= 1."""
    low, _, high = text.partition("-")
    try:
        size = (int(low), int(high or low))
    except ValueError:
        raise ValueError(f"size must be N or MIN-MAX in KB, got {text!r}") from None
    if size[0] < 1 or size[1] < size[0]:
        raise ValueError(
            f"size must be N or MIN-MAX with 1 <= MIN <= MAX, got {text!r}"
        )
    return size


def document(index: int, seed: int, size_kb: tuple[int, int]) -> tuple[str, bytes]:
    """File name and content of document ``index`` (0-based); deterministic and unique."""
    rng = random.Random(f"{seed}:{index}")
    family = FAMILIES[index % len(FAMILIES)]
    phrase = rng.choice(PHRASES[family])
    folder = FOLDERS[index % len(FOLDERS)]
    year = YEARS[index % len(YEARS)]
    reference = f"LOAD-{index + 1:06d}"
    name = f"{phrase.replace(' ', '-')}-{reference}-{year}.pdf"
    title = f"{phrase} {year} - {reference}"
    lines = [f"Service : {UNIT[folder]}", f"Reference : {reference}", f"Annee : {year}"]
    target = rng.randint(size_kb[0] * 1024, size_kb[1] * 1024)
    content = pdf_text(title, lines)
    while len(content) < target:
        # Each line adds its text plus ~30 bytes of PDF operators: a few rounds at most.
        for _ in range(max(1, (target - len(content)) // (LINE_CHARS + 30))):
            words: list[str] = []
            while sum(len(w) + 1 for w in words) < LINE_CHARS:
                words.append(rng.choice(FILLER))
            lines.append(" ".join(words))
        content = pdf_text(title, lines)
    return name, content


def check_disk(
    out: Path, estimate: int, max_total_mb: int, keep_free_gb: float
) -> None:
    if estimate > max_total_mb * 1024 * 1024:
        raise DiskGuardError(
            f"estimated {estimate / 2**20:.0f} MB > --max-total-mb {max_total_mb}: "
            "lower --files or --size-kb, or raise --max-total-mb on purpose"
        )
    probe = out if out.exists() else next(p for p in out.parents if p.exists())
    free = shutil.disk_usage(probe).free
    if free - estimate < keep_free_gb * 2**30:
        raise DiskGuardError(
            f"estimated {estimate / 2**20:.0f} MB would leave {(free - estimate) / 2**30:.1f} GB "
            f"free on {probe} (< --keep-free-gb {keep_free_gb})"
        )


def params_of(args: argparse.Namespace) -> dict:
    return {
        "files": args.files,
        "size_kb": list(parse_size(args.size_kb)),
        "batches": len(plan(args.files, args.batches)),
        "seed": args.seed,
    }


def generate(out: Path, params: dict) -> dict:
    """Write the batches, then the manifest last (its presence means the corpus is complete)."""
    for child in out.glob(f"{BATCH_PREFIX}*"):
        if child.is_dir():
            shutil.rmtree(child)
    digest = hashlib.sha256()
    total = 0
    index = 0
    counts = plan(params["files"], params["batches"])
    for number, count in enumerate(counts, start=1):
        batch = out / f"{BATCH_PREFIX}{number:04d}"
        batch.mkdir(parents=True)
        for _ in range(count):
            name, content = document(index, params["seed"], tuple(params["size_kb"]))
            (batch / name).write_bytes(content)
            digest.update(
                f"{batch.name}/{name}:{hashlib.sha256(content).hexdigest()}\n".encode()
            )
            total += len(content)
            index += 1
    manifest = {
        "generator": GENERATOR,
        "params": params,
        "files": index,
        "bytes": total,
        "batch_sizes": counts,
        "sha256": digest.hexdigest(),
    }
    (out / MANIFEST_NAME).write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--out", required=True, help="output directory (batch_* and manifest)"
    )
    parser.add_argument(
        "--files", type=int, default=100_000, help="number of files (default 100000)"
    )
    parser.add_argument(
        "--size-kb", default="1-4", help="file size in KB, N or MIN-MAX (default 1-4)"
    )
    parser.add_argument(
        "--batches", type=int, default=10, help="number of batch folders (default 10)"
    )
    parser.add_argument("--seed", type=int, default=237)
    parser.add_argument(
        "--max-total-mb",
        type=int,
        default=1024,
        help="refuse above this estimate (default 1024)",
    )
    parser.add_argument(
        "--keep-free-gb",
        type=float,
        default=5.0,
        help="free space to keep on the disk (default 5)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="replace a corpus generated with other parameters",
    )
    args = parser.parse_args(argv)
    if args.files < 1 or args.batches < 1:
        parser.error("--files and --batches must be >= 1")
    try:
        size_kb = parse_size(args.size_kb)
    except ValueError as error:
        parser.error(str(error))

    out = Path(args.out)
    params = params_of(args)
    manifest_path = out / MANIFEST_NAME
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        if existing.get("params") == params:
            print(
                f"already generated: {existing['files']} files, {existing['bytes'] / 2**20:.1f} MB in {out} (nothing written)"
            )
            return 0
        if not args.force:
            print(
                f"ERROR: {out} holds a corpus with other parameters {existing.get('params')}; use --force to replace it"
            )
            return 1

    # Estimate from a real sample: PDF overhead makes small files bigger than --size-kb.
    sample = max(
        len(document(i, args.seed, size_kb)[1]) for i in range(min(args.files, 20))
    )
    try:
        check_disk(out, sample * args.files, args.max_total_mb, args.keep_free_gb)
    except DiskGuardError as error:
        print(f"ERROR: {error}")
        return 2

    out.mkdir(parents=True, exist_ok=True)
    manifest_path.unlink(missing_ok=True)
    manifest = generate(out, params)
    print(
        f"corpus: {manifest['files']} files in {len(manifest['batch_sizes'])} batches, "
        f"{manifest['bytes'] / 2**20:.1f} MB in {out} (sha256 {manifest['sha256'][:12]})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
