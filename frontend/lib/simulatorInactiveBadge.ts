// frontend/lib/simulatorInactiveBadge.ts
export const INACTIVE_RULE_BADGE =
  "Règle désactivée : elle ne s'applique pas aux vrais documents";

/**
 * Retourne le texte du badge discret si la règle simulée est explicitement inactive (`false`).
 * Retourne `null` lorsque la règle est active ou lorsque le champ est absent.
 */
export function inactiveRuleBadgeText(ruleIsActive?: boolean | null): string | null {
  return ruleIsActive === false ? INACTIVE_RULE_BADGE : null;
}
