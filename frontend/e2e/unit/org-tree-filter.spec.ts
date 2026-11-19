import { test, expect } from '@playwright/test';
import { filterOrgTree } from '../../lib/orgTreeFilter';

const tree = [
  { name: 'Direction Générale', children: [
    { name: 'Département Études', children: [{ name: 'Cellule Qualité', children: [] }] },
    { name: 'Direction des Finances', children: [] },
  ] },
  { name: 'Secrétariat', children: [] },
];

test('requête vide : arbre inchangé', () => {
  expect(filterOrgTree(tree, '  ')).toBe(tree);
});

test('insensible à la casse et aux accents', () => {
  const r = filterOrgTree(tree, 'etudes');
  expect(r.map((n) => n.name)).toEqual(['Direction Générale']);
  expect(r[0]?.children?.map((n) => n.name)).toEqual(['Département Études']);
  expect(filterOrgTree(tree, 'SECRETARIAT').map((n) => n.name)).toEqual(['Secrétariat']);
});

test('les ancêtres d\'un résultat profond sont conservés', () => {
  const r = filterOrgTree(tree, 'qualite');
  expect(r[0]?.children?.[0]?.children?.[0]?.name).toBe('Cellule Qualité');
  expect(r[0]?.children).toHaveLength(1);
});

test('aucune correspondance : liste vide', () => {
  expect(filterOrgTree(tree, 'zzz')).toEqual([]);
});
