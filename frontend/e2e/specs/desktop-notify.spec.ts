import { test, expect } from '@playwright/test';
import {
  connectNotificationSocket,
  desktopText,
  reconnectDelay,
  shouldShowDesktop,
  targetPath,
} from '../../lib/desktopNotify';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Notifications Windows : règles', () => {
  test('reconnexion : délais croissants, plafonnés à 30 s', () => {
    expect([0, 1, 2, 3].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000]);
    expect(reconnectDelay(10)).toBe(30_000);
  });

  test('affichage : demandée, autorisée, application non regardée, non lue', () => {
    const base = { enabled: true, permission: 'granted' as const, hasFocus: false, isRead: false };
    expect(shouldShowDesktop(base)).toBe(true);
    expect(shouldShowDesktop({ ...base, enabled: false })).toBe(false);
    expect(shouldShowDesktop({ ...base, permission: 'denied' })).toBe(false);
    expect(shouldShowDesktop({ ...base, permission: 'default' })).toBe(false);
    expect(shouldShowDesktop({ ...base, hasFocus: true })).toBe(false);
    expect(shouldShowDesktop({ ...base, isRead: true })).toBe(false);
  });

  test('texte : court, sans contenu du document', () => {
    const body = (event_type: string) => desktopText({ event_type }).body;
    expect(body('WORKFLOW_ASSIGNED')).toBe('Un document attend votre visa.');
    expect(body('WORKFLOW_STEP_ACCEPTED')).toBe('Un de vos documents a reçu un visa.');
    expect(body('WORKFLOW_COMPLETED')).toBe('Un de vos documents a été visé.');
    expect(body('WORKFLOW_REJECTED')).toBe('Un de vos documents a été rejeté.');
    expect(body('WORKFLOW_RETURNED')).toBe('Un de vos documents vous est renvoyé pour correction.');
    expect(body('CLASSIFICATION_REVIEWS_PENDING')).toBe('Des documents importés sont à revoir.');
    expect(body('AUTRE')).toBe('Vous avez une nouvelle notification.');
    expect(desktopText({ event_type: 'WORKFLOW_REJECTED' }).title).toBe('GED237');
  });

  test('clic : ouvre le document s\'il est connu, sinon la liste', () => {
    expect(targetPath({ event_type: 'X', meta_data: { document_id: 'a b' } })).toBe('/documents?open=a%20b');
    expect(targetPath({ event_type: 'X' })).toBe('/documents');
    expect(targetPath({ event_type: 'CLASSIFICATION_REVIEWS_PENDING', meta_data: { document_id: 'x' } })).toBe(
      '/classification-reviews',
    );
  });
});

test.describe('Connexion temps réel par ticket (#316)', () => {
  class FakeSocket {
    static opened: FakeSocket[] = [];
    onopen?: () => void;
    onmessage?: (e: { data: string }) => void;
    onclose?: (e: { code: number }) => void;
    closed = false;
    constructor(public url: string) {
      FakeSocket.opened.push(this);
    }
    close() {
      this.closed = true;
    }
  }

  const realSocket = globalThis.WebSocket;
  // Délais demandés par la connexion ; la minuterie est injectée, jamais celle du lanceur de tests.
  let scheduled: number[] = [];
  let pending: (() => void)[] = [];
  const schedule = (fn: () => void, ms: number) => {
    scheduled.push(ms);
    pending.push(fn);
    return () => undefined;
  };
  /** Exécute le prochain essai programmé, comme si son délai était écoulé. */
  const runNextRetry = () => {
    const fn = pending.shift();
    if (!fn) throw new Error('aucun essai programmé');
    fn();
  };

  test.beforeEach(() => {
    FakeSocket.opened = [];
    scheduled = [];
    pending = [];
    (globalThis as any).WebSocket = FakeSocket;
  });

  test.afterEach(() => {
    (globalThis as any).WebSocket = realSocket;
  });

  const handlers = { onMessage: () => undefined, onOpen: () => undefined };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const lastSocket = () => {
    const socket = FakeSocket.opened.at(-1);
    if (!socket) throw new Error('aucune connexion ouverte');
    return socket;
  };

  test('le ticket va dans l\'URL, jamais le jeton de session', async () => {
    connectNotificationSocket(async () => 'a/b', handlers, schedule);
    await flush();
    expect(FakeSocket.opened).toHaveLength(1);
    expect(lastSocket().url).toMatch(/\/notifications\/ws\?ticket=a%2Fb$/);
    expect(lastSocket().url).not.toContain('token=');
  });

  test('session refusée (pas de ticket) : aucune connexion, aucun nouvel essai', async () => {
    connectNotificationSocket(async () => null, handlers, schedule);
    await flush();
    expect(FakeSocket.opened).toHaveLength(0);
    expect(scheduled).toEqual([]);
  });

  test('panne passagère du ticket : nouvel essai plus tard', async () => {
    connectNotificationSocket(async () => { throw new Error('down'); }, handlers, schedule);
    await flush();
    expect(FakeSocket.opened).toHaveLength(0);
    expect(scheduled).toEqual([1000]);
  });

  test('coupure : nouvel essai à chaque fois', async () => {
    connectNotificationSocket(async () => 't', handlers, schedule);
    await flush();
    lastSocket().onclose?.({ code: 1006 });
    runNextRetry();
    await flush();
    lastSocket().onclose?.({ code: 1006 });
    expect(scheduled).toEqual([1000, 2000]);
  });

  test('ticket refusé (1008) : un seul nouvel essai avec un ticket neuf, puis arrêt', async () => {
    let tickets = 0;
    connectNotificationSocket(async () => `t${++tickets}`, handlers, schedule);
    await flush();
    lastSocket().onclose?.({ code: 1008 });
    expect(scheduled).toEqual([1000]);
    runNextRetry();
    await flush();
    expect(tickets).toBe(2);
    expect(lastSocket().url).toMatch(/ticket=t2$/);
    lastSocket().onclose?.({ code: 1008 });
    expect(scheduled).toEqual([1000]);
  });

  test('ticket refusé après une connexion réussie : de nouveau un essai', async () => {
    connectNotificationSocket(async () => 't', handlers, schedule);
    await flush();
    lastSocket().onclose?.({ code: 1008 });
    runNextRetry();
    await flush();
    lastSocket().onopen?.();
    lastSocket().onclose?.({ code: 1008 });
    expect(scheduled).toEqual([1000, 1000]);
  });

  test('fermeture pendant la demande de ticket : rien ne s\'ouvre', async () => {
    const stop = connectNotificationSocket(async () => 't', handlers, schedule);
    stop();
    await flush();
    expect(FakeSocket.opened).toHaveLength(0);
  });
});
