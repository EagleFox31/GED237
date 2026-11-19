// Spec pur (npm run test:unit) : filtres À soumettre / Rejetés / Tous dans DraftWorkspace (Lot 4, point 2).
import { test, expect } from '@playwright/test';
import {
  countDraftStatuses,
  filterDraftDocuments,
  readDraftStatusFilter,
  writeDraftStatusFilter,
} from '../../lib/draftWorkspace';

test.describe('Filtres rapides Mon Atelier (DraftWorkspace)', () => {
  const sample = [
    { id: '1', status: 'draft' },
    { id: '2', status: 'rejected' },
    { id: '3', status: 'validated' },
    { id: '4', status: 'draft' },
  ];

  test('lit et écrit ?status= dans l URL sans perdre les autres paramètres', () => {
    expect(readDraftStatusFilter(new URLSearchParams(''))).toBe('all');
    expect(readDraftStatusFilter(new URLSearchParams('status=draft'))).toBe('draft');
    expect(readDraftStatusFilter(new URLSearchParams('status=rejected'))).toBe('rejected');
    expect(readDraftStatusFilter(new URLSearchParams('status=inconnu'))).toBe('all');

    const withFilter = writeDraftStatusFilter(new URLSearchParams('q=note'), 'draft');
    expect(withFilter.get('status')).toBe('draft');
    expect(withFilter.get('q')).toBe('note');

    const cleared = writeDraftStatusFilter(withFilter, 'all');
    expect(cleared.has('status')).toBe(false);
    expect(cleared.get('q')).toBe('note');
  });

  test('filtre et compte les brouillons, rejetés et totaux', () => {
    expect(countDraftStatuses(sample)).toEqual({ all: 4, draft: 2, rejected: 1 });
    expect(filterDraftDocuments(sample, 'draft').map((d) => d.id)).toEqual(['1', '4']);
    expect(filterDraftDocuments(sample, 'rejected').map((d) => d.id)).toEqual(['2']);
    expect(filterDraftDocuments(sample, 'all').map((d) => d.id)).toEqual(['1', '2', '3', '4']);
  });
});
