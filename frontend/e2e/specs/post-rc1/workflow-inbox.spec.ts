import { test, expect, API_URL, apiLogin, UatApi } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L3 (#153): unified validation queue GET /workflows/inbox and trashed documents in the queues.
 * The api runs with WORKFLOW_INBOX_ENABLED and WORKFLOW_PENDING_EXCLUDE_TRASHED both set from
 * E2E_WORKFLOW_INBOX (docker-compose.e2e.yml), passed to this container too: the spec checks the mode
 * the stack declares, so a run with the switch off proves today's behaviour and a run with it on the new one.
 */
const inboxOn = process.env.E2E_WORKFLOW_INBOX === 'true';

test(`file de validation, réglage ${inboxOn ? 'activé' : 'désactivé'}`, async ({ request, adminApi, adminToken, runId }) => {
  const collaboratorToken = await apiLogin(request, 'collaborator');
  const collaborator = new UatApi(request, collaboratorToken);
  const assignee = await collaborator.me();
  const doc = await adminApi.uploadDocument(`visa-${runId}.txt`, `Visa ${runId}`, `Contenu ${runId}`);
  const step = (await adminApi.submitForVisa(doc.id, assignee.id, `Visa ${runId}`))[0];
  if (!step) throw new Error('visa circuit created no step');

  const asAssignee = (path: string, params?: Record<string, string>) =>
    request.get(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${collaboratorToken}` }, params });
  const stepIds = async (res: Awaited<ReturnType<typeof asAssignee>>) => {
    expect(res.status()).toBe(200);
    return ((await res.json()) as { id: string }[]).map((s) => s.id);
  };

  expect(await stepIds(await asAssignee('/workflows/pending'))).toContain(step.id);

  const inbox = await asAssignee('/workflows/inbox', { scope: 'mine', limit: '200' });
  if (inboxOn) {
    expect(await stepIds(inbox)).toContain(step.id);
    expect(Number(inbox.headers()['x-total-count'])).toBeGreaterThanOrEqual(1);
  } else {
    expect(inbox.status()).toBe(404);
  }

  // Trash the document (explicit endpoint, same meaning before and after L2).
  const trash = await request.post(`${API_URL}/documents/${doc.id}/trash`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(trash.ok()).toBeTruthy();

  const pendingAfter = await stepIds(await asAssignee('/workflows/pending'));
  if (inboxOn) {
    expect(pendingAfter).not.toContain(step.id);
    expect(await stepIds(await asAssignee('/workflows/inbox', { scope: 'mine', limit: '200' }))).not.toContain(step.id);
  } else {
    // Switch off = unchanged behaviour: the step of a trashed document is still listed.
    expect(pendingAfter).toContain(step.id);
  }
});
