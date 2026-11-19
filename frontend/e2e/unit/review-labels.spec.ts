// Spec pur (npm run test:unit) : la fiche « Revue de classement » n'affiche ni code ni JSON du serveur.
import { test, expect } from '@playwright/test';
import {
  CLASSIFICATION_STATUS_LABELS,
  UNKNOWN_LABEL,
  auditDetailsLine,
  classificationStatusLabel,
  documentStatusLabel,
  processingModeLabel,
} from '../../lib/reviewLabels';

test.describe('Revue de classement : libellés lisibles', () => {
  test('codes connus : libellé français', () => {
    expect(documentStatusLabel('draft')).toBe('Brouillon');
    expect(processingModeLabel('process')).toBe('Ranger et lancer le circuit');
    expect(processingModeLabel('archive')).toBe('Juste les ranger');
    expect(classificationStatusLabel('pending')).toBe('En attente de classement');
  });

  test('chaque état d’un fichier importé a son libellé', () => {
    const states = ['pending', 'classified', 'needs_review', 'duplicate', 'ignored', 'imported', 'failed', 'rejected'];
    for (const state of states) expect(CLASSIFICATION_STATUS_LABELS[state], state).toBeTruthy();
  });

  test('code inconnu ou absent : jamais le code brut', () => {
    expect(documentStatusLabel('weird_state')).toBe(UNKNOWN_LABEL);
    expect(documentStatusLabel(undefined)).toBe(UNKNOWN_LABEL);
    expect(processingModeLabel('batch')).toBe(UNKNOWN_LABEL);
    expect(classificationStatusLabel(null)).toBe(UNKNOWN_LABEL);
  });

  test('historique du dépôt : titre, version, fichier, sans JSON', () => {
    const line = auditDetailsLine({ title: 'Arrêté n° 12', version: '1.0', filename: 'arrete.pdf' });
    expect(line).toBe('Arrêté n° 12 · version 1.0 · fichier arrete.pdf');
    expect(line).not.toMatch(/[{}"]/);
  });

  test('historique d’un arbitrage : rangement, relance, commentaire ; identifiants masqués', () => {
    const line = auditDetailsLine({
      classification_review_id: '7f0c-uuid',
      classification_domain_id: '11aa-uuid',
      comment: 'Courrier du DAF',
      logical_space_path: 'DAF / Courrier / 2026',
      workflow_relaunch_requested: true,
    });
    expect(line).toBe('rangé dans DAF / Courrier / 2026 · circuit relancé · « Courrier du DAF »');
    expect(line).not.toContain('uuid');
  });

  test('aucune clé connue : pas de ligne', () => {
    expect(auditDetailsLine({ classification_year: 2026, foo: 'bar' })).toBeNull();
    expect(auditDetailsLine(null)).toBeNull();
  });
});
