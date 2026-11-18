import { test, expect } from '@playwright/test';
import {
  LOGIN_INSTITUTION_STORAGE_KEY,
  LOGIN_MATRICULE_STORAGE_KEY,
  readStoredInstitution,
  writeStoredInstitution,
  readStoredMatricule,
  writeStoredMatricule,
  forgetStoredMatricule,
  shouldAutoFocusPassword,
  type KeyValueStorage,
} from '../../lib/loginFast';

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get keys(): string[] {
    return Array.from(this.map.keys());
  }
}

class FaultyStorage implements KeyValueStorage {
  getItem(): string | null {
    throw new Error('Storage disabled / SecurityError');
  }

  setItem(): void {
    throw new Error('QuotaExceededError');
  }

  removeItem(): void {
    throw new Error('SecurityError');
  }
}

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Connexion rapide (Tâche H)', () => {
  test('mémorise l institution automatiquement dans le stockage local', () => {
    const storage = new MemoryStorage();
    expect(readStoredInstitution(storage)).toBe('');

    writeStoredInstitution('  Ministère des Finances (MINFI)  ', storage);
    expect(readStoredInstitution(storage)).toBe('Ministère des Finances (MINFI)');
    expect(storage.getItem(LOGIN_INSTITUTION_STORAGE_KEY)).toBe('Ministère des Finances (MINFI)');

    // Effacement si valeur vide
    writeStoredInstitution('   ', storage);
    expect(readStoredInstitution(storage)).toBe('');
    expect(storage.getItem(LOGIN_INSTITUTION_STORAGE_KEY)).toBeNull();
  });

  test('gère gracieusement un stockage indisponible ou restreint (try/catch)', () => {
    const faulty = new FaultyStorage();
    expect(() => readStoredInstitution(faulty)).not.toThrow();
    expect(readStoredInstitution(faulty)).toBe('');
    expect(() => writeStoredInstitution('MINFI', faulty)).not.toThrow();
    expect(() => readStoredMatricule(faulty)).not.toThrow();
    expect(readStoredMatricule(faulty)).toBe('');
    expect(() => writeStoredMatricule('MINFI001', faulty)).not.toThrow();
    expect(() => forgetStoredMatricule(faulty)).not.toThrow();
  });

  test('mémorise et efface le matricule uniquement sur demande explicite', () => {
    const storage = new MemoryStorage();
    expect(readStoredMatricule(storage)).toBe('');

    // Sauvegarde active
    writeStoredMatricule('  MINFI001  ', storage);
    expect(readStoredMatricule(storage)).toBe('MINFI001');
    expect(storage.getItem(LOGIN_MATRICULE_STORAGE_KEY)).toBe('MINFI001');

    // Décochage : efface uniquement le matricule, l institution reste préservée
    writeStoredInstitution('MINFI', storage);
    forgetStoredMatricule(storage);
    expect(readStoredMatricule(storage)).toBe('');
    expect(readStoredInstitution(storage)).toBe('MINFI');
  });

  test('garantit qu aucune donnée sensible (mdp, otp, jetons) n utilise ces clés', () => {
    const storage = new MemoryStorage();
    writeStoredInstitution('MINFI', storage);
    writeStoredMatricule('MINFI001', storage);

    expect(storage.keys).toEqual([
      LOGIN_INSTITUTION_STORAGE_KEY,
      LOGIN_MATRICULE_STORAGE_KEY,
    ]);
    expect(storage.keys.some((k) => k.includes('password') || k.includes('token') || k.includes('otp'))).toBe(false);
  });

  test('détermine le focus automatique sur le mot de passe quand les 2 champs sont renseignés', () => {
    expect(shouldAutoFocusPassword('Ministère des Finances', 'MINFI001')).toBe(true);
    expect(shouldAutoFocusPassword('MINFI', 'MINFI001')).toBe(true);

    // Si l'un des deux manque, le focus mot de passe automatique n'est pas activé
    expect(shouldAutoFocusPassword('', 'MINFI001')).toBe(false);
    expect(shouldAutoFocusPassword('MINFI', '')).toBe(false);
    expect(shouldAutoFocusPassword('   ', 'MINFI001')).toBe(false);
    expect(shouldAutoFocusPassword('MINFI', '   ')).toBe(false);
    expect(shouldAutoFocusPassword('', '')).toBe(false);
  });

  test('isole les clés localStorage du cycle de nettoyage de sessionStorage (déconnexion)', () => {
    const localStore = new MemoryStorage();
    const sessionStore = new MemoryStorage();

    // Reconnexion préparée dans localStorage
    writeStoredInstitution('MINFI', localStore);
    writeStoredMatricule('MINFI001', localStore);

    // Session active dans sessionStorage
    sessionStore.setItem('access_token', 'jwt.secret.token');
    sessionStore.setItem('refresh_token', 'refresh.secret');
    sessionStore.setItem('user_profile', JSON.stringify({ matricule: 'MINFI001' }));

    // Déconnexion applicative : vide sessionStorage
    sessionStore.clear();

    // localStorage n'a pas été affecté
    expect(readStoredInstitution(localStore)).toBe('MINFI');
    expect(readStoredMatricule(localStore)).toBe('MINFI001');
  });
});
