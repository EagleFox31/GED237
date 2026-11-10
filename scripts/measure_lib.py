"""Shared helpers for the protocol measurement scripts (measure_c2, measure_c3, measure_counters).

Standard library only: the scripts run in a throw-away python container next to the e2e / demo stack.
Credentials come from the environment (MEASURE_PASSWORD), the token stays in memory and is never printed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PAGE = 100


def add_common_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("--api", default=os.environ.get("MEASURE_API", "http://localhost:8000/api/v1"))
    p.add_argument("--institution", default=os.environ.get("MEASURE_INSTITUTION", "MINFI"))
    p.add_argument("--matricule", default=os.environ.get("MEASURE_MATRICULE", "MINFI001"))
    p.add_argument("--out-dir", default=None, help="also write the report to <out-dir>/<name>-AAAA-MM-JJ.txt")


class Api:
    def __init__(self, base: str, institution: str, matricule: str):
        self.base = base.rstrip("/")
        password = os.environ.get("MEASURE_PASSWORD")
        if not password:
            sys.exit("MEASURE_PASSWORD is required (password of the measuring account)")
        login = self.request("POST", "/auth/login", {"institution": institution, "matricule": matricule, "password": password})
        otp = login.get("otp")
        if not otp:
            sys.exit("the API did not echo the OTP (ENVIRONMENT must be development): set MEASURE_OTP")
        verified = self.request("POST", "/auth/verify-otp", {"session_token": login["session_token"], "otp": otp})
        self._token = verified["access_token"]

    def request(self, method: str, route: str, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + route, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.loads(res.read() or b"null")
        except urllib.error.HTTPError as e:
            sys.exit(f"{method} {route}: HTTP {e.code}")

    def get(self, route: str):
        return self.request("GET", route, headers={"Authorization": f"Bearer {self._token}"})

    def get_all(self, route: str) -> list:
        """Page through a skip/limit list endpoint."""
        rows, skip = [], 0
        sep = "&" if "?" in route else "?"
        while True:
            page = self.get(f"{route}{sep}skip={skip}&limit={PAGE}")
            rows += page
            if len(page) < PAGE:
                return rows
            skip += PAGE


def code_maps(api: Api) -> dict:
    """id -> code for org units, domains and activities."""
    return {
        "org": {r["id"]: r["code"] for r in api.get("/org-units/")},
        "dom": {r["id"]: r["code"] for r in api.get("/classification-rules/domains")},
        "act": {r["id"]: r["code"] for r in api.get("/classification-rules/activities")},
    }


def emit(report: str, name: str, out_dir: str | None) -> None:
    print(report)
    if out_dir:
        path = Path(out_dir) / f"{name}-{dt.date.today().isoformat()}.txt"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(report + "\n", encoding="utf-8")
        print(f"-> {path}", file=sys.stderr)


def pct(num: int, den: int) -> str:
    return f"{100 * num / den:.1f} %".replace(".", ",") if den else "n/a"
