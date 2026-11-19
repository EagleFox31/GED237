import { test, expect } from '@playwright/test';
import { hasHighlightMatch, parseHighlight } from '../../lib/searchHighlight';

// Fonctions pures seulement : le rendu de HighlightedExcerpt (HTML échappé, extrait sans mot)
// est vérifié dans le navigateur par e2e/specs/uat/search-excerpt.spec.ts (cf. LESSON-2026-067).
test.describe('extrait de recherche surligné', () => {
  test('marqueurs ts_headline découpés en segments', () => {
    expect(parseHighlight('Arrêté du <mark>budget</mark> 2026')).toEqual([
      { text: 'Arrêté du ', marked: false },
      { text: 'budget', marked: true },
      { text: ' 2026', marked: false },
    ]);
  });

  test('retours à la ligne du scan ramenés à des espaces', () => {
    expect(parseHighlight('ligne 1\n\n<mark>mot</mark>\tfin')).toEqual([
      { text: 'ligne 1 ', marked: false },
      { text: 'mot', marked: true },
      { text: ' fin', marked: false },
    ]);
  });

  test('vide, absent ou sans mot trouvé : rien à afficher', () => {
    expect(parseHighlight(null)).toEqual([]);
    expect(parseHighlight('')).toEqual([]);
    expect(hasHighlightMatch(parseHighlight(undefined))).toBe(false);
    expect(hasHighlightMatch(parseHighlight('Début du texte sans le mot'))).toBe(false);
  });

  test('HTML du contenu gardé comme texte brut dans les segments', () => {
    const parts = parseHighlight('<img src=x onerror=alert(1)> <mark>budget</mark> <script>alert(2)</script>');
    expect(parts).toEqual([
      { text: '<img src=x onerror=alert(1)> ', marked: false },
      { text: 'budget', marked: true },
      { text: ' <script>alert(2)</script>', marked: false },
    ]);
  });

  test('marqueur incomplet ou attribut glissé dans la balise : texte brut', () => {
    expect(parseHighlight('<mark class="x">a</mark>')).toEqual([{ text: '<mark class="x">a', marked: false }]);
    const parts = parseHighlight('<mark>a</mark> <mark onclick="x">b');
    expect(parts.filter((p) => p.marked)).toEqual([{ text: 'a', marked: true }]);
    expect(parts.map((p) => p.text).join('')).toBe('a <mark onclick="x">b');
  });
});
