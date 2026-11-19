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
