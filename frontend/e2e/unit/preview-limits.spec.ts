import { test, expect } from '@playwright/test';
import {
  loadingLabel, loadingPercent, PREVIEW_MAX_ROWS, rowCount, truncatedRowsNotice,
} from '../../components/preview/previewLimits';

test.describe('previewLimits', () => {
  test('nombre de lignes d’une plage A1', () => {
    expect(rowCount('A1:F2000')).toBe(2000);
    expect(rowCount('B3:C10')).toBe(8);
    expect(rowCount('A1')).toBe(1);
    expect(rowCount(undefined)).toBe(0);
    expect(rowCount('n’importe quoi')).toBe(0);
  });

  test('message de troncature seulement si des lignes sont cachées', () => {
    expect(truncatedRowsNotice(PREVIEW_MAX_ROWS, PREVIEW_MAX_ROWS)).toBeNull();
    expect(truncatedRowsNotice(12, 12)).toBeNull();
    expect(truncatedRowsNotice(500, 4200)).toBe(
      'Aperçu limité aux 500 premières lignes sur 4200. Téléchargez le fichier pour tout voir.',
    );
  });

  test('libellé de chargement : taille reçue, puis sur le total quand il est connu', () => {
    expect(loadingLabel(0, null)).toBe('Chargement de l\'aperçu…');
    expect(loadingLabel(0, 30 * 1024 * 1024)).toBe('Chargement de l\'aperçu…');
    expect(loadingLabel(3 * 1024 * 1024, null)).toBe('Chargement du document (3,0 Mo reçus)…');
    expect(loadingLabel(512 * 1024, 28 * 1024 * 1024)).toBe('Chargement du document (512 Ko sur 28,0 Mo)…');
  });

  test('pourcentage borné, null sans total', () => {
    expect(loadingPercent(50, null)).toBeNull();
    expect(loadingPercent(50, 0)).toBeNull();
    expect(loadingPercent(25, 100)).toBe(25);
    expect(loadingPercent(150, 100)).toBe(100);
  });
});
