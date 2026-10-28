import hashlib
import io
import time
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import AuthenticationError, NotFoundError
from app.models.workflow import ActionType, OutcomeType
from app.schemas.workflow import WorkflowActionCreate
from app.services.analytics.dashboard_facade import DashboardFacade
from app.services.auth_service import AuthService
from app.services.classification_review_service import ClassificationReviewService
from app.services.classification_rule_engine import (
    ClassificationResolution,
    ClassificationRuleEngine,
    ClassificationStatus,
)
from app.services.ocr.base import OCRResult
from app.services.ocr.tesseract_engine import TesseractOCREngine
from app.services.space_path_builder import SpacePathBuilder
from app.services.storage.local import LocalStorageService
from app.services.workflow_service import (
    SubmitWorkflowActionUseCase,
    WorkflowActionPolicy,
)


class FakeScalars:
    def __init__(self, values):
        self.values = list(values)

    def all(self):
        return list(self.values)

    def first(self):
        return self.values[0] if self.values else None


class FakeResult:
    def __init__(self, *, scalar=None, rows=None, scalars=None, first=None):
        self._scalar = scalar
        self._rows = list(rows or [])
        self._scalars = list(scalars or [])
        self._first = first

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar

    def scalars(self):
        return FakeScalars(self._scalars)

    def all(self):
        return list(self._rows)

    def first(self):
        return self._first


class QueueDB:
    def __init__(self, *, results=None, scalar_values=None):
        self.results = list(results or [])
        self.scalar_values = list(scalar_values or [])
        self.added = []
        self.commits = 0
        self.flushes = 0
        self.refreshes = 0

    async def execute(self, _statement):
        return self.results.pop(0)

    async def scalar(self, _statement):
        return self.scalar_values.pop(0)

    def add(self, value):
        self.added.append(value)

    def add_all(self, values):
        self.added.extend(values)

    async def commit(self):
        self.commits += 1

    async def flush(self):
        self.flushes += 1
        for value in self.added:
            if hasattr(value, "id") and value.id is None:
                value.id = uuid.uuid4()

    async def refresh(self, _value):
        self.refreshes += 1


class FakeRedis:
    def __init__(self, values=None):
        self.values = dict(values or {})
        self.setex_calls = []
        self.deleted = []

    async def get(self, key):
        return self.values.get(key)

    async def setex(self, key, ttl, value):
        self.setex_calls.append((key, ttl, value))
        self.values[key] = value

    async def delete(self, *keys):
        self.deleted.extend(keys)
        for key in keys:
            self.values.pop(key, None)


class AsyncUpload:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._buffer = io.BytesIO(content)

    async def seek(self, offset: int):
        self._buffer.seek(offset)

    async def read(self, size: int = -1):
        return self._buffer.read(size)


def make_rule(**overrides):
    values = {
        "id": uuid.uuid4(),
        "name": "Rule",
        "priority": 10,
        "source_scope": "service",
        "document_category_id": None,
        "source_org_unit_id": None,
        "source_user_id": None,
        "filename_pattern": None,
        "mime_type_pattern": None,
        "target_scope": "service",
        "target_org_unit_id": None,
        "target_user_id": None,
        "year_strategy": "current",
        "fixed_year": None,
        "domain": SimpleNamespace(id=uuid.uuid4(), name="Finances"),
        "activity": SimpleNamespace(id=uuid.uuid4(), name="Budget"),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.asyncio
async def test_classification_rule_engine_patterns(monkeypatch):
    tenant_id = uuid.uuid4()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    category_id = uuid.uuid4()
    engine = ClassificationRuleEngine(QueueDB(), current_year=2026)

    assert engine._normalize("Marché ÉTÉ") == "marche ete"
    assert engine._matches_filename_pattern("Marché_public_2026.pdf", "facture; MARCHE")
    assert not engine._matches_filename_pattern("contrat.pdf", "facture;marche")
    assert engine._matches_filename_pattern("anything.pdf", " ; ")
    assert engine._matches_mime_type("application/pdf", "PDF")
    assert not engine._matches_mime_type(None, "pdf")
    assert (
        engine._resolve_year(filename="note-2024.pdf", strategy="from_filename") == 2024
    )
    assert (
        engine._resolve_year(filename="note-2099.pdf", strategy="from_filename") == 2026
    )
    assert (
        engine._resolve_year(filename="note.pdf", strategy="fixed", fixed_year=2021)
        == 2021
    )

    matching_rule = make_rule(
        document_category_id=category_id,
        source_org_unit_id=org_id,
        filename_pattern="note|memo",
        mime_type_pattern="pdf",
    )
    assert engine._matches_rule(
        rule=matching_rule,
        document_category_id=category_id,
        source_scope="service",
        source_org_unit_id=org_id,
        source_user_id=None,
        filename="NOTE interne.pdf",
        mime_type="application/pdf",
    )
    for changed in (
        {"source_scope": "person"},
        {"document_category_id": uuid.uuid4()},
        {"source_org_unit_id": uuid.uuid4()},
        {"source_user_id": uuid.uuid4()},
        {"filename_pattern": "facture"},
        {"mime_type_pattern": "image/"},
    ):
        bad_rule = make_rule(**changed)
        assert not engine._matches_rule(
            rule=bad_rule,
            document_category_id=category_id,
            source_scope="service",
            source_org_unit_id=org_id,
            source_user_id=None,
            filename="note.pdf",
            mime_type="application/pdf",
        )

    engine._load_rules = AsyncMock(return_value=[])
    engine.path_builder.build_pending_full_path = AsyncMock(
        return_value="Root / A classer / 2026"
    )
    no_rule = await engine.simulate(
        tenant_id=tenant_id,
        document_category_id=category_id,
        source_scope="service",
        source_org_unit_id=org_id,
        source_user_id=None,
        filename="x.pdf",
        mime_type="application/pdf",
    )
    assert no_rule.status == ClassificationStatus.no_rule
    assert no_rule.logical_space_path.endswith("2026")

    tied = [make_rule(priority=1), make_rule(priority=1)]
    engine._load_rules = AsyncMock(return_value=tied)
    engine.path_builder.build_pending_full_path = AsyncMock(
        return_value="Root / A revoir / 2026"
    )
    needs_review = await engine.simulate(
        tenant_id=tenant_id,
        document_category_id=None,
        source_scope="service",
        source_org_unit_id=org_id,
        source_user_id=None,
        filename="x.pdf",
        mime_type="application/pdf",
    )
    assert needs_review.status == ClassificationStatus.needs_review

    winner = make_rule(priority=1, target_scope="service")
    target_org = SimpleNamespace(id=org_id)
    engine._load_rules = AsyncMock(return_value=[winner])
    engine._resolve_target = AsyncMock(return_value=(target_org, None))
    engine.path_builder.build_full_path = AsyncMock(
        return_value="Root / Finances / Budget / 2026"
    )
    classified = await engine.simulate(
        tenant_id=tenant_id,
        document_category_id=None,
        source_scope="service",
        source_org_unit_id=org_id,
        source_user_id=None,
        filename="x.pdf",
        mime_type="application/pdf",
    )
    assert classified.status == ClassificationStatus.classified
    assert classified.domain.name == "Finances"

    engine.path_builder.build_full_path = AsyncMock(return_value=None)
    rejected = await engine.simulate(
        tenant_id=tenant_id,
        document_category_id=None,
        source_scope="service",
        source_org_unit_id=org_id,
        source_user_id=None,
        filename="x.pdf",
        mime_type="application/pdf",
    )
    assert rejected.status == ClassificationStatus.rejected

    # Restore the real _resolve_target (mocked above for simulate) before testing it.
    del engine._resolve_target
    target_user = SimpleNamespace(id=user_id, org_unit_id=org_id)
    engine._load_user = AsyncMock(return_value=target_user)
    engine._load_org_unit = AsyncMock(return_value=target_org)
    person_rule = make_rule(target_scope="person", target_user_id=user_id)
    resolved_org, resolved_user = await engine._resolve_target(
        tenant_id=tenant_id,
        rule=person_rule,
        source_org_unit_id=None,
        source_user_id=None,
    )
    assert resolved_user is target_user and resolved_org is target_org

    service_rule = make_rule(target_scope="service", target_org_unit_id=None)
    resolved_org, resolved_user = await engine._resolve_target(
        tenant_id=tenant_id,
        rule=service_rule,
        source_org_unit_id=org_id,
        source_user_id=None,
    )
    assert resolved_org is target_org and resolved_user is None

    other_rule = make_rule(target_scope="archive")
    resolved_org, resolved_user = await engine._resolve_target(
        tenant_id=tenant_id,
        rule=other_rule,
        source_org_unit_id=org_id,
        source_user_id=None,
    )
    assert resolved_org is None and resolved_user is None

    document = SimpleNamespace(
        tenant_id=tenant_id,
        document_category_id=category_id,
        org_unit_id=org_id,
        classification_domain_id="stale",
        classification_activity_id="stale",
        classification_year=2000,
        classification_scope="person",
        classification_target_org_unit_id=uuid.uuid4(),
        classification_target_user_id=uuid.uuid4(),
        classification_status="stale",
        logical_space_path="stale",
    )
    resolutions = [
        ClassificationResolution(
            status=ClassificationStatus.classified,
            message="ok",
            target_scope="service",
            target_org_unit=target_org,
            domain=winner.domain,
            activity=winner.activity,
            classification_year=2026,
            logical_space_path="Root / Finances / Budget / 2026",
        ),
        ClassificationResolution(
            status=ClassificationStatus.needs_review,
            message="review",
            classification_year=2025,
            logical_space_path="Root / A revoir / 2025",
        ),
        ClassificationResolution(
            status=ClassificationStatus.no_rule,
            message="pending",
            classification_year=2024,
            logical_space_path="Root / A classer / 2024",
        ),
        ClassificationResolution(
            status=ClassificationStatus.rejected,
            message="bad",
            logical_space_path=None,
        ),
    ]
    engine.simulate = AsyncMock(side_effect=resolutions)
    await engine.classify_document(
        document=document,
        source_scope="service",
        source_user_id=None,
        filename="x.pdf",
        mime_type="application/pdf",
    )
    assert document.classification_status == "classified"
    await engine.classify_document(
        document=document,
        source_scope="service",
        source_user_id=None,
        filename="x.pdf",
        mime_type="application/pdf",
    )
    assert document.classification_status == "needs_review"
    await engine.classify_document(
        document=document,
        source_scope="service",
        source_user_id=None,
        filename="x.pdf",
        mime_type="application/pdf",
    )
    assert document.classification_status == "pending"
    await engine.classify_document(
        document=document,
        source_scope="service",
        source_user_id=None,
        filename="x.pdf",
        mime_type="application/pdf",
    )
    assert document.classification_status == "rejected"

    db = QueueDB(
        results=[
            FakeResult(scalars=[winner]),
            FakeResult(scalar=target_org),
            FakeResult(scalar=target_user),
        ]
    )
    query_engine = ClassificationRuleEngine(db, current_year=2026)
    assert await query_engine._load_rules(tenant_id) == [winner]
    assert await query_engine._load_org_unit(org_id, tenant_id) is target_org
    assert await query_engine._load_user(user_id, tenant_id) is target_user


@pytest.mark.asyncio
async def test_space_path_builder_patterns():
    tenant_id = uuid.uuid4()
    root_id = uuid.uuid4()
    child_id = uuid.uuid4()
    orphan_id = uuid.uuid4()
    user_id = uuid.uuid4()

    db = QueueDB(
        results=[
            FakeResult(
                rows=[
                    SimpleNamespace(id=root_id, name=" Ministère / Test "),
                    SimpleNamespace(id=child_id, name=" Service   Finance "),
                ]
            ),
            FakeResult(rows=[]),
            FakeResult(
                rows=[
                    SimpleNamespace(id=root_id, parent_id=None, name="Root"),
                    SimpleNamespace(id=orphan_id, parent_id=root_id, name="Orphan"),
                ]
            ),
            FakeResult(scalar="  Alice   Doe "),
        ]
    )
    builder = SpacePathBuilder(db)

    chain = await builder._org_chain(child_id, tenant_id)
    assert chain == ["Ministère - Test", "Service Finance"]
    assert await builder._org_chain(child_id, tenant_id) == chain

    fallback = await builder._org_chain(orphan_id, tenant_id)
    assert fallback == ["Root", "Orphan"]

    assert await builder._user_name(user_id, tenant_id) == "Alice Doe"
    assert await builder._user_name(user_id, tenant_id) == "Alice Doe"

    full = await builder.build_full_path(
        tenant_id=tenant_id,
        target_org_unit_id=child_id,
        target_user_id=user_id,
        domain_name="Marchés",
        activity_name="Appels / offres",
        classification_year=2026,
    )
    assert (
        full
        == "Ministère - Test / Service Finance / Alice Doe / Marchés / Appels - offres / 2026"
    )

    pending = await builder.build_pending_full_path(
        tenant_id=tenant_id,
        target_org_unit_id=child_id,
        target_user_id=None,
        classification_year=2026,
    )
    assert pending.endswith("A classer / 2026")

    assert SpacePathBuilder._clean_segment("  A /  B  ") == "A - B"
    assert SpacePathBuilder._clean_segment(None) is None
    assert SpacePathBuilder._join_segments([]) is None
    assert (
        SpacePathBuilder.build_from_label(
            target_label="Service",
            domain_name="RH",
            activity_name="Paie",
            classification_year=2026,
        )
        == "Service / RH / Paie / 2026"
    )
    assert (
        SpacePathBuilder.build_pending_from_label(
            target_label="Service", classification_year=2026
        )
        == "Service / A classer / 2026"
    )


@pytest.mark.asyncio
async def test_local_storage_patterns(monkeypatch, tmp_path):
    service = LocalStorageService()
    service.base_path = str(tmp_path)
    payload = b"ged-patterns" * 100

    relative, checksum = await service.save_file_with_checksum(
        AsyncUpload("one.txt", payload), "tenant/docs"
    )
    assert relative == "tenant/docs/one.txt"
    assert checksum == hashlib.sha256(payload).hexdigest()
    assert service.get_file_content(relative) == payload
    assert service.get_full_path(relative).endswith("tenant/docs/one.txt")

    saved = await service.save_file(AsyncUpload("two.txt", b"two"), "tenant/docs")
    assert saved == "tenant/docs/two.txt"

    renamed = service.rename_file(saved, "renamed.txt")
    assert renamed == "tenant/docs/renamed.txt"
    assert service.rename_file("missing.txt", "x.txt") is None

    assert service.copy_file(renamed, "tenant/copies/copied.txt")
    assert service.get_file_content("tenant/copies/copied.txt") == b"two"
    assert not service.copy_file("missing.txt", "tenant/copies/no.txt")

    assert service.delete_file(relative)
    assert not service.delete_file(relative)
    assert service.get_file_content("missing.txt") == b""


def test_tesseract_engine_patterns(monkeypatch):
    import app.services.ocr.tesseract_engine as module

    engine = TesseractOCREngine(["fra", "eng"])
    assert engine.name == "Tesseract OCR"
    assert "forms" in engine.best_for
    assert engine.supports_language("fra")
    assert not engine.supports_language("xyz")

    marker = object()
    delegated = OCRResult("delegated", 1.0, engine.name, 9, 1, 0.01)
    monkeypatch.setattr(module.Image, "open", lambda _path: marker)
    monkeypatch.setattr(
        engine,
        "extract_from_pil_image",
        lambda image: delegated if image is marker else None,
    )
    assert engine.extract_from_image("scan.png") is delegated

    engine = TesseractOCREngine(["fra"])
    monkeypatch.setattr(
        module.pytesseract, "image_to_string", lambda *args, **kwargs: "Bonjour monde"
    )
    monkeypatch.setattr(
        module.pytesseract,
        "image_to_data",
        lambda *args, **kwargs: {"conf": ["-1", "80", "60"]},
    )
    result = engine.extract_from_pil_image(object())
    assert result.text == "Bonjour monde"
    assert result.confidence == pytest.approx(0.70)
    assert result.word_count == 2
    assert result.char_count == len("Bonjour monde")
    assert result.is_reliable and not result.needs_review

    monkeypatch.setattr(
        module.pytesseract, "image_to_data", lambda *args, **kwargs: {"conf": ["-1"]}
    )
    zero_conf = engine.extract_from_pil_image(object())
    assert zero_conf.confidence == 0.0 and zero_conf.needs_review

    def explode(*_args, **_kwargs):
        raise RuntimeError("tesseract unavailable")

    monkeypatch.setattr(module.pytesseract, "image_to_string", explode)
    failed = engine.extract_from_pil_image(object())
    assert failed.text == ""
    assert failed.engine_used == engine.name


@pytest.mark.asyncio
async def test_dashboard_facade_patterns():
    tenant_db = QueueDB(
        scalar_values=[4],
        results=[
            FakeResult(
                first=SimpleNamespace(total_docs=3, total_storage_bytes=2 * 1024 * 1024)
            ),
            FakeResult(first=SimpleNamespace(pending=2, completed=5, rejected=1)),
        ],
    )
    tenant_metrics = await DashboardFacade(tenant_db).get_tenant_metrics(
        str(uuid.uuid4())
    )
    assert tenant_metrics["users"]["total"] == 4
    assert tenant_metrics["documents"]["storage_used_mb"] == 2.0
    assert tenant_metrics["workflows"] == {"pending": 2, "completed": 5, "rejected": 1}

    manager_db = QueueDB(
        results=[
            FakeResult(
                first=SimpleNamespace(
                    total_docs=6, total_storage_bytes=1024 * 1024, needs_review=2
                )
            ),
            FakeResult(first=SimpleNamespace(active_workflows=3)),
        ]
    )
    manager = await DashboardFacade(manager_db).get_manager_metrics(
        str(uuid.uuid4()), str(uuid.uuid4())
    )
    assert manager["documents"] == {
        "total": 6,
        "storage_used_mb": 1.0,
        "needs_review": 2,
    }
    assert manager["active_workflows"] == 3

    platform_db = QueueDB(
        scalar_values=[2, 10],
        results=[
            FakeResult(
                first=SimpleNamespace(total_docs=20, total_storage_bytes=2 * 1024**3)
            )
        ],
    )
    platform = await DashboardFacade(platform_db).get_platform_metrics()
    assert platform["tenants"]["total"] == 2
    assert platform["users"]["total"] == 10
    assert platform["platform"] == {"total_documents": 20, "total_storage_gb": 2.0}

    empty_db = QueueDB(
        scalar_values=[0],
        results=[FakeResult(first=None), FakeResult(first=None)],
    )
    empty = await DashboardFacade(empty_db).get_tenant_metrics(str(uuid.uuid4()))
    assert empty["documents"]["total"] == 0
    assert empty["workflows"]["pending"] == 0


@pytest.mark.asyncio
async def test_auth_service_patterns(monkeypatch):
    import app.services.auth_service as module

    service = AuthService()
    assert service._normalize_value("  Ministère   Économie ") == "ministere economie"
    candidates = service._candidate_values("Ministère des Finances (MINFI)")
    assert "minfi" in candidates
    assert "ministere des finances" in candidates

    tenant = SimpleNamespace(
        id=uuid.uuid4(),
        name="Ministère des Finances",
        short_name="MINFI",
        domain="minfi.gov.cm",
        is_active=True,
    )
    resolve_db = QueueDB(results=[FakeResult(scalars=[tenant])])
    assert await service._resolve_tenant(resolve_db, "MINFI") is tenant
    with pytest.raises(AuthenticationError):
        await service._resolve_tenant(
            QueueDB(results=[FakeResult(scalars=[tenant])]), "UNKNOWN"
        )

    user = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        matricule="A001",
        password_hash="hash",
        role_id=uuid.uuid4(),
        is_active=True,
        email="a@example.test",
        first_name="Alice",
        last_name="Doe",
        full_name="Alice Doe",
        org_unit_id=uuid.uuid4(),
        must_change_password=False,
        last_login=None,
    )
    redis = FakeRedis()
    monkeypatch.setattr(service, "_resolve_tenant", AsyncMock(return_value=tenant))
    monkeypatch.setattr(module, "verify_password", lambda _raw, _hash: True)
    monkeypatch.setattr(module, "generate_otp", lambda _length: "123456")
    monkeypatch.setattr(module.secrets, "token_urlsafe", lambda _size: "session-token")
    monkeypatch.setattr(module, "get_redis", AsyncMock(return_value=redis))
    login_db = QueueDB(results=[FakeResult(scalar=user)])
    login = await service.login(login_db, "MINFI", "A001", "secret")
    assert login["session_token"] == "session-token"
    assert {call[0] for call in redis.setex_calls} == {
        "otp:session-token",
        "session:session-token",
    }

    with pytest.raises(AuthenticationError):
        await service.login(
            QueueDB(results=[FakeResult(scalar=None)]), "MINFI", "A404", "secret"
        )
    monkeypatch.setattr(module, "verify_password", lambda _raw, _hash: False)
    with pytest.raises(AuthenticationError):
        await service.login(
            QueueDB(results=[FakeResult(scalar=user)]), "MINFI", "A001", "wrong"
        )

    role = SimpleNamespace(code="standard", label="Standard")
    verify_redis = FakeRedis(
        {
            "otp:session-token": "123456",
            "session:session-token": str(user.id),
        }
    )
    monkeypatch.setattr(module, "get_redis", AsyncMock(return_value=verify_redis))
    monkeypatch.setattr(
        module, "create_access_token", lambda data: "access-" + data["sub"]
    )
    monkeypatch.setattr(
        module, "create_refresh_token", lambda data: "refresh-" + data["sub"]
    )
    verify_db = QueueDB(results=[FakeResult(scalar=user), FakeResult(scalar=role)])
    verified = await service.verify_otp(verify_db, "session-token", "123456")
    assert verified["access_token"].startswith("access-")
    assert verified["user"]["role"] == "standard"
    assert set(verify_redis.deleted) == {"otp:session-token", "session:session-token"}

    monkeypatch.setattr(module, "get_redis", AsyncMock(return_value=FakeRedis()))
    with pytest.raises(AuthenticationError):
        await service.verify_otp(QueueDB(), "missing", "123456")

    monkeypatch.setattr(
        module,
        "get_redis",
        AsyncMock(return_value=FakeRedis({"otp:s": "111111"})),
    )
    with pytest.raises(AuthenticationError):
        await service.verify_otp(QueueDB(), "s", "222222")

    monkeypatch.setattr(
        module,
        "get_redis",
        AsyncMock(return_value=FakeRedis({"otp:s": "111111"})),
    )
    with pytest.raises(AuthenticationError):
        await service.verify_otp(QueueDB(), "s", "111111")

    monkeypatch.setattr(
        module,
        "get_redis",
        AsyncMock(
            return_value=FakeRedis({"otp:s": "111111", "session:s": str(user.id)})
        ),
    )
    with pytest.raises(NotFoundError):
        await service.verify_otp(
            QueueDB(results=[FakeResult(scalar=None)]), "s", "111111"
        )

    monkeypatch.setattr(
        module,
        "decode_token",
        lambda _token: {
            "type": "refresh",
            "sub": str(user.id),
            "tenant_id": str(tenant.id),
            "role": "standard",
            "matricule": "A001",
        },
    )
    refreshed = await service.refresh_access_token("refresh")
    assert refreshed["token_type"] == "bearer"

    monkeypatch.setattr(module, "decode_token", lambda _token: {"type": "access"})
    with pytest.raises(AuthenticationError):
        await service.refresh_access_token("bad-refresh")

    monkeypatch.setattr(module, "decode_token", lambda _token: None)
    assert await service.logout("bad") == {"message": "Logged out successfully"}

    logout_redis = FakeRedis()
    monkeypatch.setattr(module, "get_redis", AsyncMock(return_value=logout_redis))
    monkeypatch.setattr(
        module,
        "decode_token",
        lambda _token: {"exp": time.time() + 120},
    )
    assert await service.logout("access") == {"message": "Logged out successfully"}
    assert logout_redis.setex_calls[0][0] == "blacklist:access"


@pytest.mark.asyncio
async def test_workflow_service_patterns(monkeypatch):
    import app.services.workflow_service as module

    actor = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4())
    version_id = uuid.uuid4()
    document = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=actor.tenant_id,
        current_version_id=version_id,
        status="in_review",
        title="Note",
    )
    step = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document.id,
        step_order=1,
        status="current",
        assigned_to=actor.id,
        expected_action_type=ActionType.visa,
        completed_at=None,
        comment=None,
    )
    action = WorkflowActionCreate(
        action_type=ActionType.visa,
        outcome=OutcomeType.accepted,
        document_version_id=version_id,
        comment="OK",
    )
    policy = WorkflowActionPolicy()

    await policy.check_can_perform_action(step, document, action, actor)

    bad_step = SimpleNamespace(**{**step.__dict__, "status": "pending"})
    with pytest.raises(Exception) as status_error:
        await policy.check_can_perform_action(bad_step, document, action, actor)
    assert getattr(status_error.value, "status_code", None) == 400

    outsider_step = SimpleNamespace(**{**step.__dict__, "assigned_to": uuid.uuid4()})
    monkeypatch.setattr(module, "can_perform", AsyncMock(return_value=False))
    with pytest.raises(Exception) as permission_error:
        await policy.check_can_perform_action(outsider_step, document, action, actor)
    assert getattr(permission_error.value, "status_code", None) == 403

    wrong_version = action.model_copy(update={"document_version_id": uuid.uuid4()})
    with pytest.raises(Exception):
        await policy.check_can_perform_action(step, document, wrong_version, actor)

    wrong_action = action.model_copy(update={"action_type": ActionType.approval})
    with pytest.raises(Exception):
        await policy.check_can_perform_action(step, document, wrong_action, actor)

    policy_mock = SimpleNamespace(check_can_perform_action=AsyncMock())
    dispatcher = SimpleNamespace(dispatch=AsyncMock())
    use_case = SubmitWorkflowActionUseCase(policy_mock, event_dispatcher=dispatcher)

    next_step = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document.id,
        step_order=2,
        status="pending",
        assigned_to=uuid.uuid4(),
        label="Visa 2",
    )
    db = QueueDB(
        results=[
            FakeResult(scalar=step),
            FakeResult(scalar=document),
            FakeResult(scalar=next_step),
        ]
    )
    trace = await use_case.execute(step_id=step.id, action=action, actor=actor, db=db)
    assert trace.workflow_step_id == step.id
    assert step.status == "completed"
    assert next_step.status == "current"
    assert db.commits == 1 and db.refreshes == 1
    dispatcher.dispatch.assert_awaited_with(
        "WORKFLOW_ASSIGNED",
        {
            "user_id": str(next_step.assigned_to),
            "tenant_id": str(document.tenant_id),
            "document_title": document.title,
            "step_name": next_step.label,
        },
    )

    final_step = SimpleNamespace(
        **{**step.__dict__, "status": "current", "completed_at": None}
    )
    final_doc = SimpleNamespace(**{**document.__dict__, "status": "in_review"})
    final_db = QueueDB(
        results=[
            FakeResult(scalar=final_step),
            FakeResult(scalar=final_doc),
            FakeResult(scalar=None),
        ]
    )
    await use_case.execute(
        step_id=final_step.id, action=action, actor=actor, db=final_db
    )
    assert final_doc.status == "validated"

    returned_step = SimpleNamespace(
        **{**step.__dict__, "status": "current", "completed_at": None}
    )
    returned_doc = SimpleNamespace(**{**document.__dict__, "status": "in_review"})
    pending = SimpleNamespace(status="pending")
    returned_action = action.model_copy(update={"outcome": OutcomeType.returned})
    returned_db = QueueDB(
        results=[
            FakeResult(scalar=returned_step),
            FakeResult(scalar=returned_doc),
            FakeResult(scalars=[pending]),
        ]
    )
    await use_case.execute(
        step_id=returned_step.id,
        action=returned_action,
        actor=actor,
        db=returned_db,
    )
    assert returned_step.status == "returned"
    assert returned_doc.status == "returned"
    assert pending.status == "cancelled"

    rejected_step = SimpleNamespace(
        **{**step.__dict__, "status": "current", "completed_at": None}
    )
    rejected_doc = SimpleNamespace(**{**document.__dict__, "status": "in_review"})
    rejected_pending = SimpleNamespace(status="pending")
    rejected_action = action.model_copy(update={"outcome": OutcomeType.rejected})
    rejected_db = QueueDB(
        results=[
            FakeResult(scalar=rejected_step),
            FakeResult(scalar=rejected_doc),
            FakeResult(scalars=[rejected_pending]),
        ]
    )
    await use_case.execute(
        step_id=rejected_step.id,
        action=rejected_action,
        actor=actor,
        db=rejected_db,
    )
    assert rejected_step.status == "rejected"
    assert rejected_doc.status == "rejected"
    assert rejected_pending.status == "rejected"

    with pytest.raises(Exception) as missing_step:
        await use_case.execute(
            step_id=uuid.uuid4(),
            action=action,
            actor=actor,
            db=QueueDB(results=[FakeResult(scalar=None)]),
        )
    assert getattr(missing_step.value, "status_code", None) == 404

    foreign_doc = SimpleNamespace(**{**document.__dict__, "tenant_id": uuid.uuid4()})
    with pytest.raises(Exception) as missing_doc:
        await use_case.execute(
            step_id=step.id,
            action=action,
            actor=actor,
            db=QueueDB(
                results=[FakeResult(scalar=step), FakeResult(scalar=foreign_doc)]
            ),
        )
    assert getattr(missing_doc.value, "status_code", None) == 404


@pytest.mark.asyncio
async def test_classification_review_document_resolution_pattern(monkeypatch):
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    target_user_id = uuid.uuid4()
    domain = SimpleNamespace(id=uuid.uuid4(), name="Finances")
    activity = SimpleNamespace(id=uuid.uuid4(), name="Budget")
    target_org = SimpleNamespace(id=org_id)
    target_user = SimpleNamespace(id=target_user_id, org_unit_id=org_id)
    actor = SimpleNamespace(id=user_id, tenant_id=tenant_id)
    review = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        review_status="open",
        resolved_by_id=None,
        resolved_at=None,
        resolution_comment=None,
    )
    document = SimpleNamespace(
        id=review.document_id,
        tenant_id=tenant_id,
        classification_status="needs_review",
        document_category_id=None,
        processing_mode="process",
        owner_id=user_id,
        org_unit_id=org_id,
        classification_domain_id=None,
        classification_activity_id=None,
        classification_year=None,
        classification_scope="service",
        classification_target_org_unit_id=None,
        classification_target_user_id=None,
        logical_space_path=None,
        title="Review doc",
        status="draft",
    )
    payload = SimpleNamespace(
        document_category_id=uuid.uuid4(),
        new_filename="renamed.pdf",
        classification_year=2026,
        classification_scope="person",
        comment="Manual review",
        relaunch_workflow=True,
    )

    service = ClassificationReviewService.__new__(ClassificationReviewService)
    service.db = QueueDB()
    service.path_builder = SimpleNamespace(
        build_full_path=AsyncMock(
            return_value="Root / Alice / Finances / Budget / 2026"
        )
    )
    service.storage_service = SimpleNamespace()
    service._get_document_for_review = AsyncMock(return_value=document)
    service._ensure_not_locked_for_write = AsyncMock()
    service._validate_category_for_tenant = AsyncMock()
    service._rename_document_file = lambda **_kwargs: ("old.pdf", "renamed.pdf")
    service._build_review_audit_log = lambda **_kwargs: SimpleNamespace()
    service._has_workflow_steps = AsyncMock(return_value=False)
    service._build_dispatch_payload = lambda _document: {
        "document_id": str(_document.id)
    }

    outcome = await service._resolve_document_review(
        review=review,
        payload=payload,
        current_user=actor,
        domain=domain,
        activity=activity,
        target_org_unit=target_org,
        target_user=target_user,
    )
    assert outcome.workflow_relaunched is True
    assert outcome.dispatch_payload == {"document_id": str(document.id)}
    assert outcome.rollback_renames == [("old.pdf", "renamed.pdf")]
    assert document.classification_status == "classified"
    assert document.owner_id == target_user_id
    assert document.classification_target_user_id == target_user_id
    assert review.review_status == "resolved"
    assert service.db.flushes == 1

    bad_document = SimpleNamespace(
        **{**document.__dict__, "classification_status": "classified"}
    )
    service._get_document_for_review = AsyncMock(return_value=bad_document)
    with pytest.raises(Exception) as not_reviewable:
        await service._resolve_document_review(
            review=review,
            payload=payload,
            current_user=actor,
            domain=domain,
            activity=activity,
            target_org_unit=target_org,
            target_user=target_user,
        )
    assert getattr(not_reviewable.value, "status_code", None) == 400

    service._get_document_for_review = AsyncMock(
        return_value=SimpleNamespace(
            **{**document.__dict__, "classification_status": "pending"}
        )
    )
    service.path_builder.build_full_path = AsyncMock(return_value=None)
    with pytest.raises(Exception) as no_path:
        await service._resolve_document_review(
            review=review,
            payload=SimpleNamespace(**{**payload.__dict__, "new_filename": None}),
            current_user=actor,
            domain=domain,
            activity=activity,
            target_org_unit=target_org,
            target_user=None,
        )
    assert getattr(no_path.value, "status_code", None) == 400


async def test_space_path_builder_user_name_runs_on_real_database(db_session, db_seed):
    # Regression: User.full_name was a plain @property, so select(User.full_name)
    # raised ArgumentError on every non-cached lookup.
    builder = SpacePathBuilder(db_session)

    name = await builder._user_name(db_seed["user_id"], db_seed["tenant_id"])

    assert name == "Test User"
    assert await builder._user_name(uuid.uuid4(), db_seed["tenant_id"]) is None
