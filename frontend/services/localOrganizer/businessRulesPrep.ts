import type { ClassificationRule } from '../../types';

/**
 * Filtre les règles utilisables côté local (actives + au moins un libellé
 * domaine ou activité pour pouvoir nommer un dossier) et reproduit l'ordre
 * d'évaluation du backend : priorité ASC, puis ancienneté ASC.
 */
export const prepareBusinessRulesForLocalMatching = (
  rules: ClassificationRule[],
): ClassificationRule[] =>
  rules
    .filter((rule) => rule.is_active !== false)
    .filter((rule) => rule.domain_name?.trim() || rule.activity_name?.trim())
    .slice()
    .sort((a, b) => {
      const pa = typeof a.priority === 'number' ? a.priority : 100;
      const pb = typeof b.priority === 'number' ? b.priority : 100;
      if (pa !== pb) return pa - pb;
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return ta - tb;
    });
