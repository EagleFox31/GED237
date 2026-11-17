import type { APIRequestContext } from '@playwright/test';

import { expect, API_URL } from '../../fixtures/uat.fixture';

/** Helpers API partagés par trash.spec et trash-empty.spec (pas un spec : hors testMatch). */
export async function upload(request: APIRequestContext, token: string, runId: string, title: string) {
  const res = await request.post(`${API_URL}/documents/upload`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      title,
      file: { name: `corbeille-${runId}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`Corbeille ${title}`, 'utf-8') },
    },
  });
  expect(res.ok(), `upload ${title}`).toBeTruthy();
  return (await res.json()) as { id: string };
}

export async function trash(request: APIRequestContext, token: string, id: string) {
  const res = await request.delete(`${API_URL}/documents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok(), `trash ${id}`).toBeTruthy();
}

/**
 * « Vider » purge toute la corbeille du tenant. Pour ne pas effacer les données des autres specs
 * (seed : « [E2E] Note en corbeille »), on sort de la corbeille tout ce qui n'est pas à `keepId`,
 * puis le rappel retourné l'y remet (à appeler dans un `finally`). Si le process meurt avant,
 * seed_e2e.py remet en corbeille les documents du manifeste marqués `trashed`.
 */
export async function setAsideTrash(
  request: APIRequestContext,
  token: string,
  keepId: string,
): Promise<() => Promise<void>> {
  const headers = { Authorization: `Bearer ${token}` };
  const setAside: string[] = [];
  const skipped = new Set<string>([keepId]);
  // Chaque restauration sort le document de la corbeille : on relit la première page jusqu'à
  // ce qu'il ne reste que `keepId` ou des documents non restaurables (page bornée par le serveur).
  for (let guard = 0; guard < 20; guard += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await request.get(`${API_URL}/documents/trash?skip=0&limit=100`, { headers });
    expect(res.ok(), 'GET /documents/trash').toBeTruthy();
    // eslint-disable-next-line no-await-in-loop
    const others = ((await res.json()) as { id: string }[]).map((doc) => doc.id).filter((id) => !skipped.has(id));
    if (others.length === 0) break;
    for (const id of others) {
      // eslint-disable-next-line no-await-in-loop
      const restored = await request.post(`${API_URL}/documents/${id}/restore`, { headers });
      if (restored.ok()) setAside.push(id);
      else skipped.add(id);
    }
  }
  return async () => {
    for (const id of setAside) {
      // eslint-disable-next-line no-await-in-loop
      await trash(request, token, id);
    }
  };
}
