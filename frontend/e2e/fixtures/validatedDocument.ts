import { expect } from '@playwright/test';

import type { UatApi } from './uat.fixture';

/**
 * Document brought to `validated` through the API: its owner opens a one-step visa circuit and the
 * validator accepts it. Shared by the archive specs (sheet and explorer bulk action).
 */
export async function validatedDocument(owner: UatApi, validator: UatApi, runId: string, title: string) {
  const doc = await owner.uploadDocument(`archive-${runId}-${title.length}.txt`, title, `Archiver ${title}`);
  const [step] = await owner.submitForVisa(doc.id, (await validator.me()).id, 'Visa archivage');
  const { current_version_id: versionId } = await owner.getDocument(doc.id);
  if (!step || !versionId) throw new Error(`circuit ou version absent pour ${title}`);
  await validator.acceptVisa(step.id, versionId);
  await expect.poll(async () => (await owner.getDocument(doc.id)).status).toBe('validated');
  return doc;
}
