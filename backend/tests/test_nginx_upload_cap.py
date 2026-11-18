"""nginx lets through every upload the API accepts, so the API answers its own 413.

Above ``client_max_body_size`` nginx cuts the request with its HTML 413 page, and the
user loses the FILE_TOO_LARGE message that names the real limit. nginx cannot read
MAX_UPLOAD_SIZE_MB: whoever raises it must raise nginx too (nginx/app-locations.conf).
Read as text on purpose: no nginx parser is a backend dependency.
"""

import re
from pathlib import Path

from app.core.config import Settings

ROOT = Path(__file__).resolve().parents[2]
NGINX = ROOT / "nginx" / "app-locations.conf"
ENV_EXAMPLES = [ROOT / "backend" / ".env.example", ROOT / ".env.example"]
MULTIPART_MARGIN_MB = 1


def _nginx_cap_mb() -> int:
    match = re.search(
        r"^\s*client_max_body_size\s+(\d+)M\s*;",
        NGINX.read_text(encoding="utf-8"),
        re.M,
    )
    assert match, f"client_max_body_size absent de {NGINX}"
    return int(match.group(1))


def _configured_caps_mb() -> list[tuple[str, int]]:
    caps = [
        (
            "défaut de Settings",
            Settings.model_fields["MAX_UPLOAD_SIZE"].default // (1024 * 1024),
        )
    ]
    for env in ENV_EXAMPLES:
        if env.exists():
            for value in re.findall(
                r"^MAX_UPLOAD_SIZE_MB=(\d+)", env.read_text(encoding="utf-8"), re.M
            ):
                caps.append((env.relative_to(ROOT).as_posix(), int(value)))
    return caps


def test_nginx_body_limit_covers_the_api_upload_cap():
    nginx_mb = _nginx_cap_mb()
    for source, cap_mb in _configured_caps_mb():
        assert nginx_mb >= cap_mb + MULTIPART_MARGIN_MB, (
            f"nginx coupe à {nginx_mb}M mais {source} autorise {cap_mb} Mo : relever "
            f"client_max_body_size à {cap_mb + MULTIPART_MARGIN_MB}M dans nginx/app-locations.conf"
        )
