import { test, expect } from '@playwright/test';
import {
  SOCKET_RETRY_FIRST_MS,
  SOCKET_RETRY_MAX_MS,
  notificationsSocketUrl,
  socketRetryDelay,
  ticketRefusalIsFinal,
} from '../../lib/notificationsSocket';

test.describe('notificationsSocketUrl', () => {
  test('API relative derrière nginx → même hôte, ws ou wss selon la page', () => {
    expect(notificationsSocketUrl('/api/v1', 'abc', 'http://localhost:8080/documents'))
      .toBe('ws://localhost:8080/api/v1/notifications/ws?ticket=abc');
    expect(notificationsSocketUrl('/api/v1/', 'abc', 'https://ged.local:8443/'))
      .toBe('wss://ged.local:8443/api/v1/notifications/ws?ticket=abc');
  });
  test('API absolue → son hôte, pas celui de la page', () => {
    expect(notificationsSocketUrl('http://localhost:8000/api/v1', 'abc', 'http://localhost:5173/'))
      .toBe('ws://localhost:8000/api/v1/notifications/ws?ticket=abc');
    expect(notificationsSocketUrl('https://api.ged.cm/api/v1', 'abc', 'http://localhost:5173/'))
      .toBe('wss://api.ged.cm/api/v1/notifications/ws?ticket=abc');
  });
  test('ticket encodé, aucun jeton dans l’adresse', () => {
    const url = notificationsSocketUrl('/api/v1', 'a+b/c=', 'http://localhost:8080/');
    expect(new URL(url).searchParams.get('ticket')).toBe('a+b/c=');
    expect(url).not.toContain('token');
  });
});

test.describe('socketRetryDelay', () => {
  test('double à chaque échec puis plafonne', () => {
    expect(socketRetryDelay(0)).toBe(SOCKET_RETRY_FIRST_MS);
    expect(socketRetryDelay(1)).toBe(2 * SOCKET_RETRY_FIRST_MS);
    expect(socketRetryDelay(2)).toBe(4 * SOCKET_RETRY_FIRST_MS);
    expect(socketRetryDelay(50)).toBe(SOCKET_RETRY_MAX_MS);
    expect(socketRetryDelay(-3)).toBe(SOCKET_RETRY_FIRST_MS);
  });
});

test.describe('ticketRefusalIsFinal', () => {
  test('session finie, droit absent ou serveur sans temps réel → arrêt', () => {
    for (const status of [401, 403, 404]) expect(ticketRefusalIsFinal(status)).toBe(true);
  });
  test('réseau ou serveur en difficulté → nouvel essai', () => {
    for (const status of [undefined, 0, 429, 500, 502, 503]) expect(ticketRefusalIsFinal(status)).toBe(false);
  });
});
