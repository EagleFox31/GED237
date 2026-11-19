import sys, resource
from pathlib import Path

sys.path.insert(0, "/app")
from app.services.ocr.rapidocr_engine import RapidOCREngine  # noqa: F401  (import mesuré)

print("torch" in sys.modules, "easyocr" in sys.modules)
print(
    "rss_mb_after_import",
    resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024,
    "cgroup",
    int(Path("/sys/fs/cgroup/memory.peak").read_text()) / 2**20,
)
