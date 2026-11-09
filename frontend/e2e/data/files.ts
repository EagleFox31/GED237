/** What setInputFiles accepts as an in-memory file (not exported by @playwright/test). */
export type FilePayload = { name: string; mimeType: string; buffer: Buffer };

let counter = 0;

/**
 * A text file with content unique to this call. The API refuses a file whose content is already
 * stored (duplicate check), so tests that upload must not share one fixture file.
 */
export function uniqueTextFile(name = 'test-document.txt'): FilePayload {
  const stamp = `${Date.now()}-${process.pid}-${++counter}`;
  return { name, mimeType: 'text/plain', buffer: Buffer.from(`Document de test E2E ${stamp}\n`) };
}
