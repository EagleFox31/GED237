// Spec pur (npm run test:unit) : détail d'un modèle de circuit (#278), libellés sans code brut.
import { test, expect } from '@playwright/test';
import {
  actionLabel,
  roleNamesById,
  scopeLabel,
  sortedSteps,
  stepSentence,
  templateDetailError,
} from '../../lib/templateDetail';

test.describe("Détail d'un modèle de circuit", () => {
  test('libellés connus et valeur inconnue', () => {
    expect(actionLabel('final_signature')).toBe('Signature finale');
    expect(scopeLabel('parent_org_unit')).toBe('du service parent');
    expect(actionLabel('stamp')).toBe('(stamp)');
  });

  test('phrase complète, rôle inconnu, niveau visé', () => {
    const step = { step_order: 1, expected_action_type: 'visa', role_id: 4, assignment_scope: 'same_org_unit' };
    expect(stepSentence(step, 'Responsable')).toBe('1. Visa — par un Responsable du même service');
    expect(stepSentence(step, null)).toBe('1. Visa — du même service');
    expect(stepSentence(step, 'Responsable', 'Direction')).toBe('1. Visa — par un Responsable au niveau Direction');
    expect(stepSentence({ step_order: 2, expected_action_type: 'approval' }, null)).toBe('2. Approbation');
  });

  test('étapes triées, liste absente', () => {
    expect(sortedSteps([{ step_order: 2 }, { step_order: 1 }]).map((s) => s.step_order)).toEqual([1, 2]);
    expect(sortedSteps(null)).toEqual([]);
  });

  test('noms de rôles : libellé maison, sinon nom du serveur', () => {
    expect(
      roleNamesById([
        { id: 4, code: 'manager', name: 'Manager' },
        { id: 9, code: 'custom', name: 'Archiviste' },
        { id: 10, code: 'other', name: null },
      ]),
    ).toEqual({ 4: 'Responsable', 9: 'Archiviste' });
  });

  test('erreurs selon le code HTTP', () => {
    expect(templateDetailError(404)).toBe('Modèle introuvable.');
    expect(templateDetailError(500)).toBe('Détail indisponible pour le moment.');
  });
});
