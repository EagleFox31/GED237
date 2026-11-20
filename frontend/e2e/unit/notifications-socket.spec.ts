import { test, expect } from '@playwright/test';
import { notificationsSocketUrl, openNotificationsSocket } from '../../lib/notificationsSocket';

test.describe('notificationsSocketUrl', () => {
  test('API relative (/api/v1) : adresse absolue sur l’hôte de la page', () => {
    expect(notificationsSocketUrl('/api/v1', 'http://ged.local/documents', 'abc')).toBe(
      'ws://ged.local/api/v1/notifications/ws?token=abc',
    );
  });
  test('basename /edossier de la page : absent de l’adresse de l’API', () => {
    expect(notificationsSocketUrl('/api/v1', 'http://ged.local/edossier/dashboard', 'abc')).toBe(
      'ws://ged.local/api/v1/notifications/ws?token=abc',
    );
  });
  test('page en https → wss, port gardé', () => {
    expect(notificationsSocketUrl('/api/v1/', 'https://ged.example.cm:8443/tasks?x=1', 'abc')).toBe(
      'wss://ged.example.cm:8443/api/v1/notifications/ws?token=abc',
    );
  });
  test('API absolue en http : son hôte et son port, pas ceux de la page', () => {
    expect(notificationsSocketUrl('http://localhost:8000/api/v1', 'http://localhost:5173/', 'abc')).toBe(
      'ws://localhost:8000/api/v1/notifications/ws?token=abc',
    );
  });
  test('API absolue en https → wss', () => {
    expect(notificationsSocketUrl('https://api.example.cm/api/v1', 'http://localhost:5173/', 'abc')).toBe(
      'wss://api.example.cm/api/v1/notifications/ws?token=abc',
    );
  });
  test('jeton encodé dans l’adresse', () => {
    expect(notificationsSocketUrl('/api/v1', 'http://ged.local/', 'a+b/c=')).toBe(
      'ws://ged.local/api/v1/notifications/ws?token=a%2Bb%2Fc%3D',
    );
  });
});

test.describe('openNotificationsSocket', () => {
  test('le navigateur refuse : null, sans exception ni jeton dans la console', () => {
    const warnings: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      const socket = openNotificationsSocket('/api/v1', 'http://ged.local/', 'secret-jeton', () => {
        throw new SyntaxError("Failed to construct 'WebSocket'");
      });
      expect(socket).toBeNull();
    } finally {
      console.warn = original;
    }
    expect(warnings).toHaveLength(1);
    expect(JSON.stringify(warnings)).not.toContain('secret-jeton');
  });

  test('le constructeur reçoit l’adresse absolue', () => {
    let seen = '';
    const fake = {} as WebSocket;
    const socket = openNotificationsSocket('/api/v1', 'https://ged.local/', 'abc', (url) => {
      seen = url;
      return fake;
    });
    expect(socket).toBe(fake);
    expect(seen).toBe('wss://ged.local/api/v1/notifications/ws?token=abc');
  });
});
