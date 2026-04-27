import asyncio
import sys

sys.path.insert(0, ".")

from app.core.rules.engine import (
    RuleEngine,
    RuleDefinition,
    TriggerEvent,
    LogicOperator,
)
from app.core.rules.interfaces import NullAuditLogger, IActionExecutionPort
from app.core.rules.execution_port import NullExecutionPort
from app.core.rules.registry import hydrate_condition, hydrate_action


class FakeExecutionPort(IActionExecutionPort):
    """In-memory port for conflict detection test."""

    def __init__(self):
        self._moved_to = None

    async def get_document(self, document_id: str):
        class FakeDoc:
            org_unit_id = "original-folder"
            status = "draft"
            category = None
            tags = []

        return FakeDoc()

    async def save_document(self, document) -> None:
        pass


async def run():
    print("=== TEST MOTEUR BETONNE (avec IActionExecutionPort) ===\n")

    context = {
        "document_id": "doc-test-001",
        "tenant_id": "tenant-abc",
        "status": "draft",
        "ocr_content": "ceci est une facture validee",
        "file_extension": "pdf",
        "mime_type": "application/pdf",
        "filename": "facture_test.pdf",
    }

    port = NullExecutionPort()
    engine = RuleEngine(audit_logger=NullAuditLogger())

    # --- Test 1 : AND logic ---
    rule_and = RuleDefinition(
        id="r1",
        name="AND test",
        conditions=[
            hydrate_condition({"type": "ocr_contains", "keyword": "facture"}),
            hydrate_condition({"type": "file_extension", "extension": "pdf"}),
        ],
        actions=[hydrate_action({"type": "add_tag", "tag": "Finance"})],
        operator=LogicOperator.AND,
    )
    engine.load_rules([rule_and])
    r = await engine.process_document(context, port, event=TriggerEvent.ANY)
    status = "PASS" if r[0]["matched"] else "FAIL"
    print(f"[{status}] AND logic        : matched={r[0]['matched']} (attendu: True)")

    # --- Test 2 : OR logic ---
    rule_or = RuleDefinition(
        id="r2",
        name="OR test",
        conditions=[
            hydrate_condition({"type": "ocr_contains", "keyword": "confidentiel"}),
            hydrate_condition({"type": "ocr_contains", "keyword": "facture"}),
        ],
        actions=[hydrate_action({"type": "set_category", "category": "Sensible"})],
        operator=LogicOperator.OR,
    )
    engine.load_rules([rule_or])
    r = await engine.process_document(context, port, event=TriggerEvent.ANY)
    status = "PASS" if r[0]["matched"] else "FAIL"
    print(f"[{status}] OR logic         : matched={r[0]['matched']} (attendu: True)")

    # --- Test 3 : AND fail ---
    rule_and_fail = RuleDefinition(
        id="r3",
        name="AND fail",
        conditions=[
            hydrate_condition({"type": "ocr_contains", "keyword": "facture"}),
            hydrate_condition({"type": "ocr_contains", "keyword": "confidentiel"}),
        ],
        actions=[hydrate_action({"type": "add_tag", "tag": "Jamais"})],
        operator=LogicOperator.AND,
    )
    engine.load_rules([rule_and_fail])
    r = await engine.process_document(context, port, event=TriggerEvent.ANY)
    status = "PASS" if not r[0]["matched"] else "FAIL"
    print(f"[{status}] AND fail         : matched={r[0]['matched']} (attendu: False)")

    # --- Test 4 : trigger_event filter ---
    rule_ocr_only = RuleDefinition(
        id="r4",
        name="OCR-only rule",
        conditions=[hydrate_condition({"type": "ocr_contains", "keyword": "facture"})],
        actions=[hydrate_action({"type": "add_tag", "tag": "OCR-tagged"})],
        trigger_event=TriggerEvent.ON_OCR_COMPLETE,
    )
    engine.load_rules([rule_ocr_only])
    r = await engine.process_document(context, port, event=TriggerEvent.ON_VALIDATION)
    status = "PASS" if len(r) == 0 else "FAIL"
    print(f"[{status}] Event filter     : {len(r)} rapport(s) (attendu: 0)")

    # --- Test 5 : dry-run ---
    rule_dry = RuleDefinition(
        id="r5",
        name="Dry run",
        conditions=[hydrate_condition({"type": "ocr_contains", "keyword": "facture"})],
        actions=[hydrate_action({"type": "add_tag", "tag": "Should-NOT-execute"})],
        dry_run=True,
    )
    engine.load_rules([rule_dry])
    r = await engine.process_document(context, port, event=TriggerEvent.ANY)
    status = "PASS" if r[0]["dry_run"] and r[0]["matched"] else "FAIL"
    print(
        f"[{status}] Dry-run          : matched={r[0]['matched']}, dry={r[0]['dry_run']} (attendu: True/True)"
    )

    # --- Test 6 : stop_on_first_match -> Exécution unique du meilleur ---
    # We now test that ONLY the best candidate executes, and lower priority is superseded.
    rule_best = RuleDefinition(
        id="r6",
        name="Meilleure règle (priorité 0)",
        conditions=[hydrate_condition({"type": "ocr_contains", "keyword": "facture"})],
        actions=[hydrate_action({"type": "add_tag", "tag": "Premier"})],
        priority=0,
    )
    rule_lower = RuleDefinition(
        id="r7",
        name="Menue fretin (priorité 1)",
        conditions=[hydrate_condition({"type": "ocr_contains", "keyword": "facture"})],
        actions=[hydrate_action({"type": "add_tag", "tag": "Bloquee"})],
        priority=1,
    )
    engine.load_rules([rule_best, rule_lower])
    r = await engine.process_document(context, port, event=TriggerEvent.ANY)
    superseded = any(
        "Superseded" in str(act.get("message"))
        for rep in r
        for act in rep.get("actions_results", [])
    )
    status = "PASS" if len(r) == 2 and superseded else "FAIL"
    print(
        f"[{status}] Priority execute   : {len(r)} rapport(s), superseded={superseded} (attendu: 2, True)"
    )

    # --- Test 7 : Ambiguity -> à_revoir ---
    fake_port = FakeExecutionPort()
    rule_move_a = RuleDefinition(
        id="r8",
        name="Move to A",
        conditions=[hydrate_condition({"type": "ocr_contains", "keyword": "facture"})],
        actions=[
            hydrate_action({"type": "move_to_folder", "target_folder_id": "folder-A"})
        ],
        priority=5,
    )
    rule_move_b = RuleDefinition(
        id="r9",
        name="Move to B (conflict)",
        conditions=[hydrate_condition({"type": "ocr_contains", "keyword": "facture"})],
        actions=[
            hydrate_action({"type": "move_to_folder", "target_folder_id": "folder-B"})
        ],
        priority=5,
    )
    engine.load_rules([rule_move_a, rule_move_b])
    r = await engine.process_document(context, fake_port, event=TriggerEvent.ANY)
    has_system_report = any(
        rep.get("rule_id") == "system-arbitration"
        and "Ambiguïté" in rep.get("arbitration_reason", "")
        for rep in r
    )
    status = "PASS" if has_system_report else "FAIL"
    print(
        f"[{status}] Ambiguity detect   : system_report={has_system_report} (attendu: True)"
    )

    # --- Test 8 : Fallback if NO match ---
    engine.load_rules(
        [
            RuleDefinition(
                id="r10",
                name="No match",
                conditions=[
                    hydrate_condition(
                        {"type": "ocr_contains", "keyword": "introuvable"}
                    )
                ],
                actions=[hydrate_action({"type": "add_tag", "tag": "x"})],
                priority=0,
            )
        ]
    )
    r = await engine.process_document(context, fake_port, event=TriggerEvent.ANY)
    has_system_report = any(rep.get("rule_id") == "system-arbitration" for rep in r)
    status = "PASS" if has_system_report else "FAIL"
    print(
        f"[{status}] No match fallback  : system_report={has_system_report} (attendu: True)"
    )

    # --- Test 9 : Weak Match (Priority >= 30) -> à_revoir ---
    engine.load_rules(
        [
            RuleDefinition(
                id="r11",
                name="Weak Match",
                conditions=[
                    hydrate_condition({"type": "ocr_contains", "keyword": "facture"})
                ],
                actions=[hydrate_action({"type": "add_tag", "tag": "x"})],
                priority=35,
            )
        ]
    )
    r = await engine.process_document(context, fake_port, event=TriggerEvent.ANY)
    has_weak_report = any(
        rep.get("rule_id") == "system-arbitration"
        and "Match faible" in rep.get("arbitration_reason", "")
        for rep in r
    )
    status = "PASS" if has_weak_report else "FAIL"
    print(
        f"[{status}] Weak match fallback: system_report={has_weak_report} (attendu: True)"
    )

    # --- Test 10 : N-of-M Condition ---
    engine.load_rules(
        [
            RuleDefinition(
                id="r12",
                name="N of M Test",
                conditions=[
                    hydrate_condition(
                        {
                            "type": "ocr_n_of_m",
                            "keywords": ["facture", "introuvable1", "validee"],
                            "min_matches": 2,
                        }
                    )
                ],
                actions=[hydrate_action({"type": "add_tag", "tag": "N-of-M"})],
                priority=5,
            )
        ]
    )
    r = await engine.process_document(context, fake_port, event=TriggerEvent.ANY)
    matched = any(rep.get("matched") and rep.get("rule_id") == "r12" for rep in r)
    status = "PASS" if matched else "FAIL"
    print(f"[{status}] N of M Condition   : matched={matched} (attendu: True)")

    print("\n=== 10/10 tests exécutés ===")


if __name__ == "__main__":
    asyncio.run(run())
