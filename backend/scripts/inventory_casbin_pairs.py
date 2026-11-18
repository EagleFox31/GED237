"""Inventaire (resource, action) -> routes ou Casbin est le seul contrôle vs garde métier en plus.

Usage : python -I inv_casbin.py <backend/app> > out.json
"""

import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1])
AUTH = {"authorize_or_403", "can_perform"}
SIGNALS = {
    "role_code": re.compile(r"_role_code\(|\.role\.code|role_code\b"),
    "role_set": re.compile(
        r"\b(ADMIN_ROLES|TENANT_WIDE_READ_ROLES|ORG_UNIT_READ_ROLES|VALIDATOR_ROLE_CODES|INSTITUTION_WIDE_ROLES)\b"
    ),
    "scope": re.compile(
        r"assert_org_unit_scope|tenant_guard|reports_scope|org_unit_scope"
    ),
    "own_or_unit_cmp": re.compile(
        r"(org_unit_id|owner_id|created_by_id|performed_by)\s*(==|!=)"
    ),
    "http403": re.compile(r"status_code\s*=\s*403|HTTP_403"),
    "dep_role": re.compile(r"Depends\(\s*require_\w+"),
}
SKIP_GUARD_FILES = {"core/authz"}


def call_name(node):
    f = node.func
    return (
        f.id
        if isinstance(f, ast.Name)
        else f.attr
        if isinstance(f, ast.Attribute)
        else None
    )


def const(n):
    return n.value if isinstance(n, ast.Constant) and isinstance(n.value, str) else None


def route_info(fn):
    for d in fn.decorator_list:
        if (
            isinstance(d, ast.Call)
            and isinstance(d.func, ast.Attribute)
            and d.func.attr in {"get", "post", "put", "patch", "delete"}
        ):
            p = const(d.args[0]) if d.args else ""
            return f"{d.func.attr.upper()} {p}"
    return None


rows = []
for path in sorted(ROOT.rglob("*.py")):
    rel = path.relative_to(ROOT).as_posix()
    if rel.startswith("core/authz"):
        continue
    src = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(src)
    except SyntaxError:
        continue
    funcs = {
        n.name: n
        for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    for name, fn in funcs.items():
        calls = [n for n in ast.walk(fn) if isinstance(n, ast.Call)]
        auths = [c for c in calls if call_name(c) in AUTH]
        if not auths:
            continue
        seg = ast.get_source_segment(src, fn) or ""
        # un niveau d'aide locale appelée (hors fonctions d'authz)
        helpers = {call_name(c) for c in calls} & set(funcs) - {name}
        helper_src = "".join(
            ast.get_source_segment(src, funcs[h]) or "" for h in helpers
        )
        # une aide qui appelle elle-même authorize ne compte pas comme garde
        text = seg + "\n" + helper_src
        found = sorted(k for k, rx in SIGNALS.items() if rx.search(text))
        for c in auths:
            args = c.args
            res = const(args[1]) if len(args) > 1 else None
            act = const(args[2]) if len(args) > 2 else None
            for kw in c.keywords:
                if kw.arg == "resource":
                    res = const(kw.value)
                if kw.arg == "action":
                    act = const(kw.value)
            rows.append(
                {
                    "file": rel,
                    "func": name,
                    "route": route_info(fn),
                    "line": c.lineno,
                    "resource": res,
                    "action": act,
                    "dynamic": res is None or act is None,
                    "guards": found,
                    "helpers": sorted(helpers),
                }
            )

print(json.dumps(rows, ensure_ascii=False, indent=1))
