"""Photos SYNTHETIQUES a partir de la serie dbd (meme verite terrain) : fond de table, perspective, flou leger,
eclairage inegal, JPEG q70, ~12 MP (4000x3000). Graine fixe : relancable a l'identique."""

import random, shutil
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter

SRC = Path("/bench/propre")
OUT = Path("/bench/photo-synth")
TRUTH = Path("/bench/truth")
OUT.mkdir(parents=True, exist_ok=True)
W, H = 4000, 3000
rng = random.Random(237)


def coeffs(src_pts, dst_pts):
    a = []
    for (x, y), (u, v) in zip(src_pts, dst_pts):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    A = np.array(a, dtype=float)
    B = np.array(dst_pts, dtype=float).reshape(8)
    return np.linalg.solve(A, B)


for i, src in enumerate(sorted(SRC.glob("fr-dbd-clean-*.png"))):
    page = Image.open(src).convert("RGB")
    pw, ph = page.size
    # la page occupe ~ 45 % de la hauteur utile : portrait photographie en paysage, avec marges
    scale = (H * 0.92) / ph
    page = page.resize((int(pw * scale), int(ph * scale)), Image.LANCZOS)
    pw, ph = page.size
    bg = Image.new(
        "RGB", (W, H), (92 + rng.randint(-15, 15), 70 + rng.randint(-10, 10), 52)
    )
    ox, oy = (W - pw) // 2, (H - ph) // 2
    jitter = lambda: rng.randint(-int(0.04 * pw), int(0.04 * pw))
    # destination -> source (PIL transform attend les coefficients de dst vers src)
    dst = [
        (ox + jitter(), oy + jitter()),
        (ox + pw + jitter(), oy + jitter()),
        (ox + pw + jitter(), oy + ph + jitter()),
        (ox + jitter(), oy + ph + jitter()),
    ]
    src_pts = [(0, 0), (pw, 0), (pw, ph), (0, ph)]
    c = coeffs(dst, src_pts)
    warped = page.transform(
        (W, H), Image.PERSPECTIVE, tuple(c), Image.BICUBIC, fillcolor=(0, 0, 0)
    )
    mask = Image.new("L", page.size, 255).transform(
        (W, H), Image.PERSPECTIVE, tuple(c), Image.BILINEAR, fillcolor=0
    )
    bg.paste(warped, (0, 0), mask)
    img = bg.filter(ImageFilter.GaussianBlur(radius=1.2))
    arr = np.asarray(img, dtype=np.float32)
    # eclairage inegal : degrade lineaire + vignette
    yy, xx = np.mgrid[0:H, 0:W]
    ang = rng.uniform(0, 2 * np.pi)
    grad = (
        1.0 + 0.28 * ((xx / W - 0.5) * np.cos(ang) + (yy / H - 0.5) * np.sin(ang)) * 2
    )
    vign = 1.0 - 0.25 * (((xx / W - 0.5) ** 2 + (yy / H - 0.5) ** 2) * 2)
    arr = np.clip(
        arr * (grad * vign)[..., None]
        + np.random.RandomState(i).normal(0, 3, arr.shape),
        0,
        255,
    ).astype("uint8")
    name = f"synth-photo-dbd-{i + 1:02d}"
    Image.fromarray(arr).save(OUT / f"{name}.jpg", quality=70)
    shutil.copy(
        TRUTH / f'{src.stem.replace("clean", "clean")}.txt', TRUTH / f"{name}.txt"
    )
    print(name, W * H / 1e6, "MP")
