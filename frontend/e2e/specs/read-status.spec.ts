import { test, expect } from '@playwright/test';
import { canRetryRead, readStateOf, READ_STATE_LABEL } from '../../lib/readStatus';

test('états de lecture : normal sans pastille, échec, en cours', () => {
  for (const ok of [undefined, null, '', 'not_processed', 'completed']) expect(readStateOf(ok)).toBe('none');
  expect(readStateOf('failed')).toBe('failed');
  expect(readStateOf('FAILED')).toBe('failed');
  expect(readStateOf('processing')).toBe('processing');
});

test('une valeur inconnue s\'affiche comme « en cours », sans rien casser', () => {
  expect(readStateOf('quelque_chose_de_nouveau')).toBe('processing');
});

test('aucun libellé ne montre le mot OCR', () => {
  for (const label of Object.values(READ_STATE_LABEL)) expect(label).not.toMatch(/ocr/i);
  expect(READ_STATE_LABEL.failed).toBe('Lecture en échec');
});

test('le bouton de relance n\'apparaît qu\'en échec et pas pour le lecteur', () => {
  expect(canRetryRead('failed', 'manager')).toBe(true);
  expect(canRetryRead('failed', 'reader')).toBe(false);
  expect(canRetryRead('completed', 'manager')).toBe(false);
  expect(canRetryRead('failed', undefined)).toBe(false);
});
