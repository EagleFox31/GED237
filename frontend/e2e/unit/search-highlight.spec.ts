import { test, expect } from '@playwright/test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasHighlightMatch, parseHighlight } from '../../lib/searchHighlight';
import { HighlightedExcerpt } from '../../components/HighlightedExcerpt';

const render = (highlight: string | null | undefined) =>
  renderToStaticMarkup(React.createElement(HighlightedExcerpt, { highlight }));

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
    expect(hasHighlightMatch(parseHighlight('Début du texte sans le mot'))).toBe(false);
    expect(render(undefined)).toBe('');
    expect(render('Début du texte sans le mot')).toBe('');
  });

  test('HTML présent dans le contenu du scan rendu comme du texte, jamais interprété', () => {
    const injected = '<img src=x onerror=alert(1)> <mark>budget</mark> <script>alert(2)</script><b>gras</b>';
    const html = render(injected);
    expect(html).not.toMatch(/<img|<script|<b>/);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(html).toMatch(/<mark[^>]*>budget<\/mark>/);
  });

  test('marqueur incomplet ou attribut glissé dans la balise : texte brut', () => {
    expect(parseHighlight('<mark class="x">a</mark>')).toEqual([{ text: '<mark class="x">a', marked: false }]);
    const html = render('<mark>a</mark> <mark onclick="x">b');
    expect(html).toContain('&lt;mark onclick=&quot;x&quot;&gt;b');
    expect(html.match(/<mark/g)).toHaveLength(1);
  });
});
