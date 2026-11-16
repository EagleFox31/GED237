import { test, expect } from '@playwright/test';
import { isSafeInternalPath } from '../../services/http/safePath';

test.describe('Garde de redirection après reconnexion', () => {
  for (const path of ['/documents', '/documents?q=a#x', '/spaces/12']) {
    test(`accepte ${path}`, () => {
      expect(isSafeInternalPath(path)).toBe(true);
    });
  }

  for (const path of ['//evil.example', '/\evil.example', 'https://evil.example', 'javascript:alert(1)', 'documents', '/a\nb', '', null, 42]) {
    test(`refuse ${JSON.stringify(path)}`, () => {
      expect(isSafeInternalPath(path)).toBe(false);
    });
  }
});
