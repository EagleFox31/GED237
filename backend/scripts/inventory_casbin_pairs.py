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


def local_assigns(fn):
    """nom -> expression, pour les variables locales assignées une seule fois."""
    seen, dup = {}, set()
    for n in ast.walk(fn):
        if isinstance(n, ast.Assign) and len(n.targets) == 1:
            t = n.targets[0]
            if isinstance(t, ast.Name):
                if t.id in seen:
                    dup.add(t.id)
                seen[t.id] = n.value
    return {k: v for k, v in seen.items() if k not in dup}


def const_values(n, env=None):
    """Valeurs chaîne possibles d'un argument : constante, ``a if c else b`` de constantes,
    ou variable locale assignée une fois à l'une de ces formes."""
    env = env or {}
    if isinstance(n, ast.Name) and n.id in env:
        return const_values(env[n.id], {k: v for k, v in env.items() if k != n.id})
    if isinstance(n, ast.IfExp):
        body, other = const_values(n.body, env), const_values(n.orelse, env)
        return body + other if body and other else []
    value = const(n)
    return [value] if value is not None else []


_module_cache = {}


def module_funcs(module):
    """Fonctions d'un module de l'application (``app.x.y``), sources comprises."""
    if module in _module_cache:
        return _module_cache[module]
    result = {}
    parts = module.split(".")[1:] if module.startswith("app.") else []
    for candidate in (
        ROOT.joinpath(*parts).with_suffix(".py"),
        ROOT.joinpath(*parts, "__init__.py"),
    ):
        if parts and candidate.is_file():
            text = candidate.read_text(encoding="utf-8")
            try:
                tree = ast.parse(text)
            except SyntaxError:
                break
            result = {
                n.name: ast.get_source_segment(text, n) or ""
                for n in ast.walk(tree)
                if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
            }
            break
    _module_cache[module] = result
    return result


def imported_helpers(tree):
    """nom importé -> source de la fonction, pour les aides importées d'un autre module."""
    found = {}
    for n in ast.walk(tree):
        if isinstance(n, ast.ImportFrom) and n.module and n.level == 0:
            funcs = module_funcs(n.module)
            for alias in n.names:
                if alias.name in funcs:
                    found[alias.asname or alias.name] = funcs[alias.name]
    return found


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
    imports = imported_helpers(tree)
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
        imported = sorted({call_name(c) for c in calls} & set(imports))
        imported_src = "".join(imports[h] for h in imported)
        text = seg + "\n" + helper_src + "\n" + imported_src
        found = sorted(k for k, rx in SIGNALS.items() if rx.search(text))
        env = local_assigns(fn)
        for c in auths:
            args = c.args
            res_node = args[1] if len(args) > 1 else None
            act_node = args[2] if len(args) > 2 else None
            for kw in c.keywords:
                if kw.arg == "resource":
                    res_node = kw.value
                if kw.arg == "action":
                    act_node = kw.value
            resources = const_values(res_node, env) if res_node is not None else []
            actions = const_values(act_node, env) if act_node is not None else []
            for res, act in (
                [(r, a) for r in resources for a in actions]
                if resources and actions
                else [(None, None)]
            ):
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
                        "imported_helpers": imported,
                    }
                )

print(json.dumps(rows, ensure_ascii=False, indent=1))
