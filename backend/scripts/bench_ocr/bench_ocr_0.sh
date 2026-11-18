#!/usr/bin/env bash
# OCR-0 benchmark runner (gestion-projet/innovateur/protocole-ocr-0.md): one capped container per engine.
#   BASE_IMAGE=<api image> backend/scripts/bench_ocr/bench_ocr_0.sh <work dir> [pdf dir]
# <work dir> receives truth/, clean/, degraded/ (from the PDFs) and results/. A real/ folder already in
# <work dir> (lot B, never committed) is measured too; its ground truth goes in truth/ under the same name.
# Caps reproduce the VPS constraint. Containers run with --rm: nothing keeps running after the script.
set -euo pipefail

WORK=${1:?usage: BASE_IMAGE=<api image> $0 <work dir> [pdf dir]}
PDF_DIR=${2:-}
BASE_IMAGE=${BASE_IMAGE:?set BASE_IMAGE to the built API image}
BENCH_IMAGE=${BENCH_IMAGE:-ged237-bench-ocr0}
ENGINES=${ENGINES:-t-fast t-best easyocr rapidocr}
CAPS=(--memory=1g --memory-swap=1g --cpus=2 --rm)
export MSYS_NO_PATHCONV=1  # Git Bash on Windows: keep container paths as written

host_path() { (cd "$1" && (pwd -W 2>/dev/null || pwd)); }
here=$(host_path "$(dirname "$0")")
mkdir -p "$WORK/results"
work=$(host_path "$WORK")

docker build -q -f "$here/Dockerfile.bench" --build-arg BASE_IMAGE="$BASE_IMAGE" -t "$BENCH_IMAGE" "$here" >/dev/null
bench() { docker run "${CAPS[@]}" "$@"; }

if [ -n "$PDF_DIR" ]; then
  bench -v "$work:/bench" -v "$(host_path "$PDF_DIR"):/pdf:ro" "$BENCH_IMAGE" \
    python -I scripts/bench_ocr_0.py prepare --pdf-dir /pdf --out /bench ${BENCH_LIMIT:+--limit "$BENCH_LIMIT"}
fi

lots=(--lot "A propre=/bench/clean" --lot "A dégradé=/bench/degraded")
[ -d "$WORK/real" ] && lots+=(--lot "B=/bench/real")

rm -f "$WORK/results/exit_codes.txt"  # one run, one set of results
for engine in $ENGINES; do
  rm -f "$WORK/results/bench_ocr_0_$engine.csv" "$WORK/results/bench_ocr_0_$engine.meta.json"
  status=0
  bench --name "bench-ocr0-$engine" -v "$work:/bench" "$BENCH_IMAGE" \
    python -I scripts/bench_ocr_0.py run --engine "$engine" "${lots[@]}" --truth /bench/truth --out /bench/results \
    || status=$?
  # 137 = killed by the cgroup OOM killer at the 1 GB cap: a result, not a script failure.
  [ "$status" -eq 0 ] || echo "$engine: exit $status$([ "$status" -eq 137 ] && echo ' (OOM)')" | tee -a "$WORK/results/exit_codes.txt"
done

bench -v "$work:/bench" "$BENCH_IMAGE" python -I scripts/bench_ocr_0.py table --results /bench/results \
  | tee "$WORK/results/table.md"
bench "$BENCH_IMAGE" sh -c 'pip freeze | grep -i -E "rapidocr|onnxruntime|easyocr|torch|pytesseract|jiwer"; tesseract --version 2>&1 | head -1' \
  | tee "$WORK/results/versions.txt"
