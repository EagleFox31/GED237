import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { subscribeToNotifications } from '../../lib/notificationsSocket';

// useNotifications ne se rend pas ici (pas de React dans e2e/unit, LESSON-2026-067) : on teste le corps
// de son effet, puis on vérifie dans le source que le hook passe bien par lui (seul test exécuté en CI).
const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIPPED = new Set(['node_modules', 'dist', 'e2e', 'e2e-out', 'playwright-report', 'test-results']);

type Log = { level: string; args: unknown[] };
const captureConsole = <T>(run: () => T): { result: T; logs: Log[] } => {
  const logs: Log[] = [];
  const saved = { log: console.log, warn: console.warn, error: console.error };
  for (const level of ['log', 'warn', 'error'] as const) {
    console[level] = (...args: unknown[]) => {
      logs.push({ level, args });
    };
  }
  try {
    return { result: run(), logs };
  } finally {
    Object.assign(console, saved);
  }
};

const fakeSocket = () => {
  const socket = { closed: 0, close() { socket.closed += 1; } } as unknown as WebSocket & { closed: number };
  return socket;
};

test.describe('subscribeToNotifications (effet de useNotifications)', () => {
  test('ouvre une fois via le helper, ajoute les messages, ferme au nettoyage', () => {
    const socket = fakeSocket();
    const urls: string[] = [];
    const received: unknown[] = [];
    const { result: cleanup, logs } = captureConsole(() => {
      const stop = subscribeToNotifications('/api/v1', 'http://ged.local/edossier/', 'secret-jeton', (d) => received.push(d), (url) => {
        urls.push(url);
        return socket;
      });
      socket.onopen?.(new Event('open'));
      socket.onmessage?.({ data: '{"id":"n1"}' } as MessageEvent);
      socket.onmessage?.({ data: 'pas du json' } as MessageEvent);
      socket.onclose?.({} as CloseEvent);
      return stop;
    });
    expect(urls).toEqual(['ws://ged.local/api/v1/notifications/ws?token=secret-jeton']);
    expect(received).toEqual([{ id: 'n1' }]);
    expect(logs.filter((l) => l.level === 'error')).toHaveLength(1);
    expect(JSON.stringify(logs.map((l) => l.args.map(String)))).not.toContain('secret-jeton');
    expect(cleanup).toBeInstanceOf(Function);
    cleanup?.();
    expect(socket.closed).toBe(1);
  });

  test('sans jeton : aucune ouverture', () => {
    let calls = 0;
    const cleanup = subscribeToNotifications('/api/v1', 'http://ged.local/', null, () => undefined, () => {
      calls += 1;
      return fakeSocket();
    });
    expect(calls).toBe(0);
    expect(cleanup).toBeUndefined();
  });

  test('ouverture refusée : un seul essai, rien à fermer, jeton absent des journaux', () => {
    let calls = 0;
    const { result: cleanup, logs } = captureConsole(() =>
      subscribeToNotifications('/api/v1', 'http://ged.local/', 'secret-jeton', () => undefined, () => {
        calls += 1;
        throw new SyntaxError("Failed to construct 'WebSocket'");
      }),
    );
    expect(calls).toBe(1);
    expect(cleanup).toBeUndefined();
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs.map((l) => l.args.map(String)))).not.toContain('secret-jeton');
  });
});

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return SKIPPED.has(entry.name) || entry.name.startsWith('.') ? [] : sources(join(dir, entry.name));
    return /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : [];
  });

test.describe('useNotifications passe par le helper', () => {
  test('l’effet du hook délègue à subscribeToNotifications, sans jeton journalisé', () => {
    const hook = readFileSync(join(FRONTEND, 'hooks', 'useNotifications.ts'), 'utf8');
    expect(hook).toMatch(/import \{[^}]*\bsubscribeToNotifications\b[^}]*\} from '\.\.\/lib\/notificationsSocket'/);
    expect(hook).toMatch(/useEffect\(\s*\(\)\s*=>\s*subscribeToNotifications\(/);
    expect(hook).not.toMatch(/new WebSocket\(/);
    expect(hook).not.toMatch(/console\.\w+\([^)]*token/i);
  });

  test('aucun autre `new WebSocket(` dans le code de l’application', () => {
    const offenders = sources(FRONTEND)
      .filter((file) => /new WebSocket\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(FRONTEND, file).split(sep).join('/'));
    expect(offenders).toEqual(['lib/notificationsSocket.ts']);
  });
});
