import { test, expect } from '@playwright/test';
import { openDocumentAccess, openPendingTab, resolveAccessUrl, type PendingTab } from '../../lib/documentAccess';

test.describe('« Ouvrir » par lien signé (F-NEXT-02)', () => {
  const path = '/api/v1/documents/stream/tok.en';

  test('le chemin est résolu sur l’hôte de l’API', () => {
    expect(resolveAccessUrl(path, 'http://localhost:8000/api/v1', 'http://localhost:3000/documents')).toBe(
      'http://localhost:8000/api/v1/documents/stream/tok.en',
    );
    // API servie par la même origine que l'application (VITE_API_URL relatif).
    expect(resolveAccessUrl(path, '/api/v1', 'https://ged.example.cm/documents?open=1')).toBe(
      'https://ged.example.cm/api/v1/documents/stream/tok.en',
    );
  });

  test('une adresse hors de l’API est refusée', () => {
    for (const bad of ['https://ailleurs.example/x', '//ailleurs.example/x', 'javascript:alert(1)', 'stream/tok']) {
      expect(() => resolveAccessUrl(bad, 'http://localhost:8000/api/v1', 'http://localhost:3000/')).toThrow(
        'Lien d’ouverture invalide.',
      );
    }
  });

  const fakeWindow = (allowPopup: boolean) => {
    const calls: Array<[string, string, string | undefined]> = [];
    const tab = { opener: {} as unknown, closed: false, location: { href: '' }, close() { this.closed = true; } };
    const win = {
      open(url: string, target: string, features?: string) {
        calls.push([url, target, features]);
        return allowPopup ? tab : null;
      },
    } as unknown as Window;
    return { win, tab, calls };
  };

  test('l’onglet ouvert pendant le clic reçoit le lien, sans accès à l’application', () => {
    const { win, tab, calls } = fakeWindow(true);
    const pending = openPendingTab(win);
    expect(calls).toEqual([['', '_blank', undefined]]);
    expect(tab.opener).toBeNull();
    pending.go('http://api/x');
    expect(tab.location.href).toBe('http://api/x');
    expect(calls).toHaveLength(1);
  });

  test('échec de la demande : l’onglet vide est refermé', () => {
    const { win, tab } = fakeWindow(true);
    openPendingTab(win).cancel();
    expect(tab.closed).toBe(true);
  });

  test('onglet bloqué : nouvelle tentative directe, opener coupé ; refus total signalé', () => {
    const { win, tab, calls } = fakeWindow(false);
    let retryAllowed = true;
    (win as unknown as { open: (u: string, t: string, f?: string) => unknown }).open = (url, target, features) => {
      calls.push([url, target, features]);
      return url && retryAllowed ? tab : null;
    };
    expect(openPendingTab(win).go('http://api/x')).toBe(true);
    expect(calls).toEqual([
      ['', '_blank', undefined],
      ['http://api/x', '_blank', undefined],
    ]);
    expect(tab.opener).toBeNull();
    retryAllowed = false;
    expect(openPendingTab(win).go('http://api/x')).toBe(false);
  });

  const recordingTab = (opens = true) => {
    const log: string[] = [];
    const tab: PendingTab = {
      go: (url) => {
        log.push(`go ${url}`);
        return opens;
      },
      cancel: () => log.push('cancel'),
    };
    return { tab, log };
  };
  const api = 'http://localhost:8000/api/v1';
  const page = 'http://localhost:3000/documents';

  test('openDocumentAccess : lien reçu, onglet dirigé', async () => {
    const { tab, log } = recordingTab();
    expect(await openDocumentAccess(tab, async () => ({ url: path }), api, page)).toBe('opened');
    expect(log).toEqual(['go http://localhost:8000/api/v1/documents/stream/tok.en']);
  });

  test('openDocumentAccess : échec HTTP ou lien invalide, onglet refermé', async () => {
    const failed = recordingTab();
    const outcome = await openDocumentAccess(failed.tab, () => Promise.reject(new Error('429')), api, page);
    expect(outcome).toBe('request-failed');
    expect(failed.log).toEqual(['cancel']);

    const invalid = recordingTab();
    expect(await openDocumentAccess(invalid.tab, async () => ({ url: 'https://ailleurs.example/x' }), api, page)).toBe(
      'invalid-link',
    );
    expect(invalid.log).toEqual(['cancel']);
  });

  test('openDocumentAccess : fenêtres bloquées signalées', async () => {
    const { tab } = recordingTab(false);
    expect(await openDocumentAccess(tab, async () => ({ url: path }), api, page)).toBe('blocked');
  });
});
