import { test, expect } from '@playwright/test';
import { absentCandidates, choosesAcrossInstitution, myOutgoingActive, onBehalfOfName, standInCandidates, toAwareIso } from '../../lib/delegation';
import type { Delegation } from '../../types';

const ME = 'u-me';
const ABSENT = 'u-absent';

const delegation = (over: Partial<Delegation> = {}): Delegation => ({
  id: 'd1',
  org_unit_id: 'ou1',
  delegator: { id: ABSENT, full_name: 'Awa Absente' },
  delegate: { id: ME, full_name: 'Moi Intérim' },
  starts_at: '2026-11-20T08:00:00+01:00',
  ends_at: '2026-11-27T08:00:00+01:00',
  revoked_at: null,
  created_by: 'u-chef',
  created_at: '2026-11-19T10:00:00+01:00',
  status: 'active',
  ...over,
});

test.describe('Délégation : règles d’affichage', () => {
  test('toAwareIso ajoute le fuseau et garde l’heure locale', () => {
    const iso = toAwareIso('2026-11-20T08:30');
    expect(iso).toMatch(/^2026-11-20T08:30:00[+-]\d{2}:\d{2}$/);
    expect(new Date(iso!).getTime()).toBe(new Date('2026-11-20T08:30').getTime());
  });

  test('toAwareIso refuse une saisie vide ou invalide', () => {
    expect(toAwareIso('')).toBeNull();
    expect(toAwareIso('pas une date')).toBeNull();
  });

  test('« au nom de » seulement pour une tâche de l’absent dont je suis l’intérimaire', () => {
    const mine = [delegation()];
    expect(onBehalfOfName(ABSENT, ME, mine)).toBe('Awa Absente');
    expect(onBehalfOfName(ME, ME, mine)).toBeNull();
    expect(onBehalfOfName(null, ME, mine)).toBeNull();
    expect(onBehalfOfName('u-autre', ME, mine)).toBeNull();
    expect(onBehalfOfName(ABSENT, undefined, mine)).toBeNull();
  });

  test('une délégation prévue ou annulée ne donne pas « au nom de »', () => {
    expect(onBehalfOfName(ABSENT, ME, [delegation({ status: 'scheduled' })])).toBeNull();
    expect(onBehalfOfName(ABSENT, ME, [delegation({ status: 'revoked' })])).toBeNull();
  });

  test('bandeau : seule ma délégation sortante en cours compte', () => {
    const outgoing = delegation({
      id: 'd2',
      delegator: { id: ME, full_name: 'Moi' },
      delegate: { id: 'u-collegue', full_name: 'Paul Collègue' },
    });
    expect(myOutgoingActive([delegation(), outgoing], ME)?.id).toBe('d2');
    expect(myOutgoingActive([delegation()], ME)).toBeNull();
    expect(myOutgoingActive([{ ...outgoing, status: 'scheduled' }], ME)).toBeNull();
    expect(myOutgoingActive([outgoing], undefined)).toBeNull();
  });

  test('formulaire : absents sans soi-même ni agent hors service', () => {
    const users = [
      { id: ME, full_name: 'Moi', org_unit_id: 'ou-1' },
      { id: 'a', full_name: 'Absente', org_unit_id: 'ou-1' },
      { id: 'b', full_name: 'Collègue', org_unit_id: 'ou-1' },
      { id: 'c', full_name: 'Autre service', org_unit_id: 'ou-2' },
      { id: 'd', full_name: 'Sans service', org_unit_id: null },
    ];
    expect(absentCandidates(users, ME).map((u) => u.id)).toEqual(['a', 'b', 'c']);
  });

  test('formulaire : remplaçants = candidats du service qui peuvent valider, ni l’absent ni soi-même', () => {
    const service = [
      { id: ME, full_name: 'Moi', org_unit_id: 'ou-1', can_stand_in: true },
      { id: 'a', full_name: 'Absente', org_unit_id: 'ou-1', can_stand_in: true },
      { id: 'm', full_name: 'Chef', org_unit_id: 'ou-1', can_stand_in: true },
      { id: 'r', full_name: 'Lecteur', org_unit_id: 'ou-1', can_stand_in: false },
      { id: 'x', full_name: 'Sans avis du serveur', org_unit_id: 'ou-1' },
    ];
    expect(standInCandidates(service, ME, 'a').map((u) => u.id)).toEqual(['m']);
    expect(standInCandidates(service, ME, '')).toEqual([]);
    expect(standInCandidates([], ME, 'a')).toEqual([]);
  });

  test('formulaire : seuls les profils de l’institution choisissent l’absent hors de leur service', () => {
    expect(choosesAcrossInstitution('tenant')).toBe(true);
    expect(choosesAcrossInstitution('super')).toBe(false);
    expect(choosesAcrossInstitution('manager')).toBe(false);
    expect(choosesAcrossInstitution('unit')).toBe(false);
    expect(choosesAcrossInstitution(undefined)).toBe(false);
  });
});
