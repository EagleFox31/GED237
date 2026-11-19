"""Hierarchy tree builder (V1.2, item 11): depth, scope cascade, 200-node cap."""

from types import SimpleNamespace
from uuid import uuid4

from app.services.hierarchy_tree import MAX_NODES, build_hierarchy_tree


class Org:
    """In-memory reporting lines, with a log of what each loader was asked."""

    def __init__(self):
        self.users = {}
        self.loaded: list[list] = []

    def add(self, name, manager=None):
        user = SimpleNamespace(
            id=uuid4(), name=name, reports_to=manager.id if manager else None
        )
        self.users[user.id] = user
        return user

    def team(self, manager, size, prefix):
        return [self.add(f"{prefix}{i}", manager) for i in range(size)]

    async def load_reports(self, ids):
        self.loaded.append(list(ids))
        grouped = {}
        for user in self.users.values():
            if user.reports_to in ids:
                grouped.setdefault(user.reports_to, []).append(user)
        return grouped

    async def count_reports(self, ids):
        counts = {}
        for user in self.users.values():
            if user.reports_to in ids:
                counts[user.reports_to] = counts.get(user.reports_to, 0) + 1
        return counts

    async def tree(self, root, depth=2, can_expand=lambda _u: True, cap=MAX_NODES):
        return await build_hierarchy_tree(
            root,
            depth=depth,
            can_expand=can_expand,
            load_reports=self.load_reports,
            count_reports=self.count_reports,
            cap=cap,
        )


def names(nodes):
    return [n.user.name for n in nodes]


def size(node):
    return 1 + sum(size(c) for c in node.children or [])


async def test_default_depth_loads_n1_and_n2_and_marks_n3_not_loaded():
    org = Org()
    boss = org.add("boss")
    n1 = org.add("n1", boss)
    n2 = org.add("n2", n1)
    org.add("n3", n2)

    root = await org.tree(boss)

    assert names(root.children) == ["n1"]
    assert names(root.children[0].children) == ["n2"]
    frontier = root.children[0].children[0]
    assert frontier.reports_count == 1
    assert frontier.children is None  # "not loaded yet": expand with n2 as root


async def test_depth_six_reaches_n6():
    org = Org()
    chain = [org.add("n0")]
    for i in range(1, 8):
        chain.append(org.add(f"n{i}", chain[-1]))

    node = await org.tree(chain[0], depth=6)
    for _ in range(6):
        node = node.children[0]
    assert node.user.name == "n6"
    assert node.children is None and node.reports_count == 1


async def test_a_leaf_has_no_reports_and_an_empty_list():
    org = Org()
    boss = org.add("boss")
    org.add("alone", boss)

    root = await org.tree(boss, depth=1)

    assert root.children[0].reports_count == 0
    assert root.children[0].children == []


async def test_scope_cascade_hides_what_cannot_be_expanded():
    org = Org()
    me = org.add("me")
    n1 = org.add("n1", me)
    org.team(n1, 3, "n2-")

    root = await org.tree(me, depth=3, can_expand=lambda u: u.id == me.id)

    assert names(root.children) == ["n1"]
    child = root.children[0]
    # N-2 is beyond reach: neither listed nor counted, so its existence is not revealed.
    assert child.reports_count == 0
    assert child.children == []
    assert org.loaded == [[me.id]]


async def test_cap_counts_the_root_and_never_exceeds_200_nodes():
    org = Org()
    boss = org.add("boss")
    big = org.add("big", boss)
    small = org.add("small", boss)
    org.team(big, 250, "b")
    org.team(small, 5, "s")

    root = await org.tree(boss)

    by_name = {n.user.name: n for n in root.children}
    assert by_name["big"].reports_count == 250
    assert by_name["big"].children is None  # too big for what is left: expandable later
    assert names(by_name["small"].children) == [f"s{i}" for i in range(5)]
    assert size(root) <= MAX_NODES
    # The 250 reports were counted, never loaded.
    assert all(big.id not in ids for ids in org.loaded)


async def test_cap_reached_exactly():
    org = Org()
    boss = org.add("boss")
    org.team(boss, MAX_NODES - 1, "u")

    root = await org.tree(boss, depth=1)

    assert size(root) == MAX_NODES
    assert len(root.children) == MAX_NODES - 1


async def test_a_reporting_cycle_does_not_loop():
    org = Org()
    a = org.add("a")
    b = org.add("b", a)
    a.reports_to = b.id  # bad data: a <-> b

    root = await org.tree(a, depth=6)

    assert names(root.children) == ["b"]
    assert root.children[0].children == []
    assert size(root) == 2
