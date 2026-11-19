"""Fichiers OCR de l'étape 5 bis de la démo : D1 note de service, D2 bon de commande, D1-scan.
Tout est fictif. Photos synthétiques par la méthode du banc OCR (fond de table, perspective,
flou léger, éclairage inégal, JPEG q70, 4000x3000), graine 237 : relançable à l'identique.
Usage, dans un conteneur python:3.12-slim avec fonts-dejavu-core, pillow et numpy :
    python gen_demo_ocr.py <dossier de sortie>"""
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'out')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
PW, PH = 2480, 3508  # A4 à 300 dpi
M = 220  # marge
FOOT = 'Document fictif - démonstration GED237'


def f(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def wrap(draw, text, font, width):
    lines, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=font) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def page_d1():
    img = Image.new('L', (PW, PH), 255)
    d = ImageDraw.Draw(img)
    y = M
    for line in ('MINISTÈRE DES FINANCES', 'Direction des Affaires Financières', 'Service du matériel'):
        d.text((M, y), line, font=f(46, True), fill=0)
        y += 66
    d.text((PW - M - 620, M), 'Yaoundé, le 14 novembre 2026', font=f(42), fill=0)
    y += 140
    title = 'NOTE DE SERVICE N° 0412/DAF/SM'
    d.text(((PW - d.textlength(title, font=f(64, True))) / 2, y), title, font=f(64, True), fill=0)
    y += 150
    d.text((M, y), 'Objet : inventaire des photocopieurs', font=f(54, True), fill=0)
    y += 130
    body = [
        "Il est demandé à chaque bureau de recenser les photocopieurs en service avant le "
        "15 décembre 2026.",
        "Pour chaque appareil, indiquer la marque, le numéro d'inventaire, le bureau "
        "d'affectation et l'état de fonctionnement.",
        "Les photocopieurs hors service sont signalés au service du matériel, qui organise "
        "leur enlèvement. Aucun appareil ne doit être déplacé sans bon de sortie.",
        "Les fiches remplies sont transmises au secrétariat de la Direction des Affaires "
        "Financières.",
    ]
    for para in body:
        for line in wrap(d, para, f(48), PW - 2 * M):
            d.text((M, y), line, font=f(48), fill=0)
            y += 72
        y += 48
    y += 120
    d.text((PW - M - 900, y), 'Le Chef du service du matériel', font=f(46, True), fill=0)
    d.text((PW - M - 900, y + 80), '(signé)', font=f(46), fill=0)
    d.text((M, PH - M), FOOT, font=f(34), fill=90)
    return img


def page_d2():
    img = Image.new('L', (PW, PH), 255)
    d = ImageDraw.Draw(img)
    y = M
    d.text((M, y), 'MINISTÈRE DES FINANCES - Direction des Affaires Financières', font=f(44, True), fill=0)
    y += 160
    title = 'BON DE COMMANDE DE FOURNITURES N° BC-0413'
    d.text(((PW - d.textlength(title, font=f(60, True))) / 2, y), title, font=f(60, True), fill=0)
    y += 160
    fields = [
        ('Service demandeur', 'Direction des Affaires Financières'),
        ('Fournisseur', 'Papeterie du Centre (fictif)'),
        ('Date de la demande', '14/11/2026'),
        ('Imputation', 'Fournitures de bureau 2026'),
    ]
    for k, v in fields:
        d.text((M, y), k + ' :', font=f(46, True), fill=0)
        d.rectangle((M + 760, y - 12, PW - M, y + 64), outline=0, width=3)
        d.text((M + 790, y), v, font=f(46), fill=0)
        y += 110
    y += 80
    cols = [M, M + 900, M + 1260, M + 1680, PW - M]
    head = ['Désignation', 'Quantité', 'Prix unitaire', 'Montant']
    rows = [
        ('Agrafeuses de bureau', '10', '5 000', '50 000'),
        ('Classeurs à levier', '40', '1 500', '60 000'),
        ('Ramettes de papier A4', '25', '3 000', '75 000'),
        ('Boîtes d\'agrafes', '20', '500', '10 000'),
    ]
    rh = 110
    for r, cells in enumerate([head] + rows + [('Total (FCFA)', '', '', '195 000')]):
        top = y + r * rh
        d.rectangle((cols[0], top, cols[-1], top + rh), outline=0, width=3)
        for c in range(1, 4):
            d.line((cols[c], top, cols[c], top + rh), fill=0, width=3)
        bold = r == 0 or r == len(rows) + 1
        for c, text in enumerate(cells):
            d.text((cols[c] + 28, top + 30), text, font=f(46, bold), fill=0)
    y += (len(rows) + 2) * rh + 100
    d.text((M, y), 'Observations :', font=f(46, True), fill=0)
    d.rectangle((M, y + 80, PW - M, y + 300), outline=0, width=3)
    d.text((M + 30, y + 110), 'Livrer les agrafeuses et les classeurs en une seule fois.', font=f(46), fill=0)
    y += 420
    d.text((M, y), 'Visa du chef de service :', font=f(46, True), fill=0)
    d.rectangle((M + 760, y - 12, M + 1500, y + 200), outline=0, width=3)
    d.text((M + 790, y + 60), '(visé)', font=f(46), fill=0)
    d.text((M, PH - M), FOOT, font=f(34), fill=90)
    return img


def coeffs(src_pts, dst_pts):
    a = []
    for (x, y), (u, v) in zip(src_pts, dst_pts):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(a, dtype=float), np.array(dst_pts, dtype=float).reshape(8))


def synth_photo(page, rng, seed):
    """Même transformation que le banc OCR (synth_photos.py)."""
    W, H = 4000, 3000
    page = page.convert('RGB')
    pw, ph = page.size
    scale = (H * 0.92) / ph
    page = page.resize((int(pw * scale), int(ph * scale)), Image.LANCZOS)
    pw, ph = page.size
    bg = Image.new('RGB', (W, H), (92 + rng.randint(-15, 15), 70 + rng.randint(-10, 10), 52))
    ox, oy = (W - pw) // 2, (H - ph) // 2

    def jitter():
        return rng.randint(-int(0.04 * pw), int(0.04 * pw))

    dst = [(ox + jitter(), oy + jitter()), (ox + pw + jitter(), oy + jitter()),
           (ox + pw + jitter(), oy + ph + jitter()), (ox + jitter(), oy + ph + jitter())]
    c = coeffs(dst, [(0, 0), (pw, 0), (pw, ph), (0, ph)])
    warped = page.transform((W, H), Image.PERSPECTIVE, tuple(c), Image.BICUBIC, fillcolor=(0, 0, 0))
    mask = Image.new('L', page.size, 255).transform((W, H), Image.PERSPECTIVE, tuple(c), Image.BILINEAR, fillcolor=0)
    bg.paste(warped, (0, 0), mask)
    arr = np.asarray(bg.filter(ImageFilter.GaussianBlur(radius=1.2)), dtype=np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    ang = rng.uniform(0, 2 * np.pi)
    grad = 1.0 + 0.28 * ((xx / W - 0.5) * np.cos(ang) + (yy / H - 0.5) * np.sin(ang)) * 2
    vign = 1.0 - 0.25 * (((xx / W - 0.5) ** 2 + (yy / H - 0.5) ** 2) * 2)
    arr = np.clip(arr * (grad * vign)[..., None] + np.random.RandomState(seed).normal(0, 3, arr.shape), 0, 255)
    return Image.fromarray(arr.astype('uint8'))


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(237)
    d1, d2 = page_d1(), page_d2()
    synth_photo(d1, rng, 0).save(OUT / 'IMG_0412.jpg', quality=70)
    synth_photo(d2, rng, 1).save(OUT / 'IMG_0413.jpg', quality=70)
    d1.save(OUT / 'SCAN_0412.pdf', resolution=300)
    for p in sorted(OUT.iterdir()):
        print(p.name, p.stat().st_size)
