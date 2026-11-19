"""Hierarchy tree of a user (V1.2, item 11): N-1, N-2 and beyond, in one call.

Pure logic: the loaders are injected, so the scope cascade and the node cap are
tested without a database (tests/services/test_hierarchy_tree.py).

Rules
- ``depth`` levels below the root are loaded; a node on the last level keeps
  ``children=None`` when it has reports: "not loaded yet", the client asks again
  with that node as the root.
- Scope cascade: the subordinates of a node are read only if ``can_expand(node)``.
  A node that cannot be expanded shows ``reports_count=0`` and no children, so
  nothing beyond the caller's reach is revealed (the #247 rule).
- Cap: at most ``cap`` nodes per response, root included. A node whose children
  would exceed it keeps ``children=None`` and stays expandable.
- A reporting cycle (bad data) cannot loop: a user appears once per tree.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Awaitable, Callable, Dict, List, Optional, Sequence
from uuid import UUID

DEFAULT_DEPTH = 2
MAX_DEPTH = 6
MAX_NODES = 200


@dataclass(eq=False)
class TreeNode:
    user: object  # app.models.user.User, or any object with ``id``
    reports_count: int = 0
    children: Optional[List["TreeNode"]] = field(default_factory=list)


LoadReports = Callable[[Sequence[UUID]], Awaitable[Dict[UUID, list]]]
CountReports = Callable[[Sequence[UUID]], Awaitable[Dict[UUID, int]]]


async def build_hierarchy_tree(
    root,
    *,
    depth: int,
    can_expand: Callable[[object], bool],
    load_reports: LoadReports,
    count_reports: CountReports,
    cap: int = MAX_NODES,
) -> TreeNode:
    """Breadth-first. Per level: one count query, then the reports of the nodes
    that fit under the cap only, so a manager with thousands of reports never
    loads them all."""
    root_node = TreeNode(user=root)
    seen = {root.id}
    total = 1
    level = [root_node]

    for current_depth in range(depth + 1):
        expandable = []
        for node in level:
            if can_expand(node.user):
                expandable.append(node)
            else:
                node.reports_count = 0
                node.children = []
        if not expandable:
            break

        counts = await count_reports([n.user.id for n in expandable])
        for node in expandable:
            node.reports_count = counts.get(node.user.id, 0)
            node.children = None if node.reports_count else []
        if current_depth == depth:  # frontier: how many, not who
            break

        # Greedy, in display order: a node too big for what is left keeps
        # children=None, a smaller one after it may still fit.
        budget = cap - total
        chosen = []
        for node in expandable:
            if 0 < node.reports_count <= budget:
                chosen.append(node)
                budget -= node.reports_count
        if not chosen:
            break

        reports = await load_reports([n.user.id for n in chosen])
        next_level: List[TreeNode] = []
        for node in chosen:
            kids = [u for u in reports.get(node.user.id, []) if u.id not in seen]
            node.children = [TreeNode(user=u) for u in kids]
            seen.update(u.id for u in kids)
            total += len(kids)
            next_level.extend(node.children)
        if not next_level:
            break
        level = next_level

    return root_node
