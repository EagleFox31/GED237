// Spec pur (npm run test:unit) : options du filtre « Statut » de l'explorateur Documents.
import { test, expect } from '@playwright/test';
import { DOCUMENT_STATUS_FILTERS, statusesForFilter } from '../../lib/documentStatusFilter';

test.describe('Filtre Statut des documents', () => {
  test('« À corriger » couvre les documents rejetés et renvoyés', () => {
    expect(statusesForFilter('to_fix')).toEqual(['rejected', 'returned']);
  });

  test('une option simple envoie son seul statut', () => {
    expect(statusesForFilter('draft')).toEqual(['draft']);
  });

  test('« Tous » ou une valeur inconnue : aucun filtre', () => {
    expect(statusesForFilter('')).toEqual([]);
    expect(statusesForFilter('nimporte')).toEqual([]);
  });

  test('valeurs et libellés uniques', () => {
    const values = DOCUMENT_STATUS_FILTERS.map((o) => o.value);
    const labels = DOCUMENT_STATUS_FILTERS.map((o) => o.label);
    expect(new Set(values).size).toBe(values.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test('le résultat est une copie (la table reste intacte)', () => {
    statusesForFilter('to_fix').push('draft');
    expect(statusesForFilter('to_fix')).toEqual(['rejected', 'returned']);
  });
});
