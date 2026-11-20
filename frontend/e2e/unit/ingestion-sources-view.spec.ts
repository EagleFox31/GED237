import { test, expect } from '@playwright/test';
import type { IngestionSource } from '../../services/resources/ingestionSources.api';
import {
  canRunNow,
  emptySourceForm,
  formFromSource,
  formatRunAt,
  runConflictMessage,
  runSummary,
  toCreatePayload,
  toUpdatePayload,
  validateSourceForm,
} from '../../profiles/tenant-admin/pages/ingestionSources/sourcesView';

const source = (over: Partial<IngestionSource> = {}): IngestionSource => ({
  id: 's1',
  name: 'Courrier',
  source_type: 'smb',
  path: '/data/ingest/courrier',
  credentials_ref: 'smb_courrier',
  agent_key_prefix: null,
  org_unit_id: 'u1',
  owner_id: 'o1',
  document_category_id: null,
  recursive: true,
  processing_mode: 'archive',
  enabled: true,
  last_run_at: null,
  last_run_status: null,
  last_run_report: null,
  created_at: '2026-11-20T08:00:00Z',
  updated_at: '2026-11-20T08:00:00Z',
  ...over,
});

test.describe('Sources de collecte — règles d’écran (F-NEXT-03)', () => {
  test('les refus de collecte (409) sont dits en clair', () => {
    expect(runConflictMessage('This source is already being collected')).toBe('Une collecte est déjà en cours pour cette source.');
    expect(runConflictMessage('The owner of this source is disabled')).toMatch(/^Le propriétaire/);
    expect(runConflictMessage('This source is disabled')).toBe('Cette source est désactivée.');
    expect(runConflictMessage('An agent source is pushed by its agent')).toBe('Cette source est alimentée par son agent.');
    expect(runConflictMessage('Something new')).toBe('Collecte impossible pour le moment.');
    expect(runConflictMessage(undefined)).toBe('Collecte impossible pour le moment.');
  });

  test('« Collecter » : dossiers du serveur actifs seulement', () => {
    expect(canRunNow({ source_type: 'local', enabled: true })).toBe(true);
    expect(canRunNow({ source_type: 'smb', enabled: false })).toBe(false);
    expect(canRunNow({ source_type: 'agent', enabled: true })).toBe(false);
  });

  test('validation : nom, dossier selon le type, nom de secret sans chemin', () => {
    expect(validateSourceForm(emptySourceForm())).toEqual({
      name: 'Donnez un nom à la source.',
      path: 'Indiquez le dossier à collecter.',
    });
    const agent = { ...emptySourceForm(), name: 'Poste accueil', source_type: 'agent' as const };
    expect(validateSourceForm(agent)).toEqual({});
    for (const bad of ['../etc', '.cache', 'a/b', 'a..b']) {
      const errors = validateSourceForm({ ...emptySourceForm(), name: 'S', source_type: 'smb', path: '/p', credentials_ref: bad });
      expect(errors.credentials_ref, bad).toBeTruthy();
    }
    expect(validateSourceForm({ ...emptySourceForm(), name: 'S', source_type: 'smb', path: '/p', credentials_ref: 'smb_rh.v2' })).toEqual({});
  });

  test('création : seuls les champs du type choisi sont envoyés', () => {
    const base = { ...emptySourceForm(), name: '  Poste  ', path: '/x', credentials_ref: 'ref' };
    expect(toCreatePayload({ ...base, source_type: 'agent' })).toEqual({
      name: 'Poste',
      source_type: 'agent',
      recursive: true,
      processing_mode: 'archive',
      enabled: true,
    });
    expect(toCreatePayload({ ...base, source_type: 'local' })).not.toHaveProperty('credentials_ref');
    expect(toCreatePayload({ ...base, source_type: 'smb', org_unit_id: 'u2' })).toMatchObject({
      path: '/x',
      credentials_ref: 'ref',
      org_unit_id: 'u2',
    });
  });

  test('modification : seulement ce qui a changé, rien si rien', () => {
    const current = source();
    expect(toUpdatePayload(formFromSource(current), current)).toBeNull();
    expect(toUpdatePayload({ ...formFromSource(current), name: 'Courrier 2', recursive: false }, current)).toEqual({
      name: 'Courrier 2',
      recursive: false,
    });
    // Vider le nom du secret l'efface côté serveur.
    expect(toUpdatePayload({ ...formFromSource(current), credentials_ref: ' ' }, current)).toEqual({ credentials_ref: null });
    const agent = source({ source_type: 'agent', path: null, credentials_ref: null });
    expect(toUpdatePayload({ ...formFromSource(agent), enabled: false }, agent)).toEqual({ enabled: false });
  });

  test('résumé et date de collecte', () => {
    expect(runSummary({ imported: 12, skipped: 1, error_count: 0 })).toBe('12 ajoutés, 1 ignoré, 0 erreur');
    expect(runSummary({ imported: 1500, skipped: 0, error_count: 2 })).toMatch(/^1\s500 ajoutés, 0 ignoré, 2 erreurs$/);
    expect(formatRunAt('2026-11-20T09:32:00')).toBe('20/11/2026 09:32');
    expect(formatRunAt('pas une date')).toBe('—');
  });
});
