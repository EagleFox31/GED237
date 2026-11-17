// Détail d'un modèle de circuit (#278, partie B) : libellés en français simple, jamais de code brut.
// Sans React, testé par `npm run test:unit`.

import { ROLE_HUMAN_LABEL } from './roleLabels';

export type TemplateStep = {
  step_order: number;
  label?: string | null;
  expected_action_type: string;
  role_id?: number | null;
  assignment_scope?: string | null;
  target_unit_type_id?: number | null;
};

/** Réponse de GET /gedrules/templates/{id} (champs lus par l'écran). */
export type TemplateDetail = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  steps: TemplateStep[];
};

const ACTION_LABELS: Record<string, string> = {
  read_ack: 'Prise de connaissance',
  visa: 'Visa',
  approval: 'Approbation',
  final_signature: 'Signature finale',
};

const SCOPE_LABELS: Record<string, string> = {
  same_org_unit: 'du même service',
  parent_org_unit: 'du service parent',
  grandparent_org_unit: 'du service au-dessus du parent',
};

/** Valeur sans libellé connu : affichée brute, entre parenthèses, en attendant un libellé. */
const orRaw = (labels: Record<string, string>, value: string): string => labels[value] ?? `(${value})`;

export const actionLabel = (value: string): string => orRaw(ACTION_LABELS, value);

export const scopeLabel = (value: string): string => orRaw(SCOPE_LABELS, value);

/**
 * « 1. Visa — par un Manager du même service ».
 * `roleName` : nom en clair du rôle (résolu par l'appelant), null si inconnu.
 * `unitTypeLabel` : niveau visé quand l'étape cible un type d'unité (prioritaire sur la portée).
 */
export const stepSentence = (step: TemplateStep, roleName: string | null, unitTypeLabel?: string | null): string => {
  let where = '';
  if (unitTypeLabel) where = `au niveau ${unitTypeLabel}`;
  else if (step.assignment_scope) where = scopeLabel(step.assignment_scope);
  const who = [roleName ? `par un ${roleName}` : '', where].filter(Boolean).join(' ');
  return `${step.step_order}. ${actionLabel(step.expected_action_type)}${who ? ` — ${who}` : ''}`;
};

export const sortedSteps = <T extends { step_order: number }>(steps: readonly T[] | null | undefined): T[] =>
  [...(steps ?? [])].sort((a, b) => a.step_order - b.step_order);

export const templateDetailError = (status: number | undefined): string => {
  if (status === 404) return 'Modèle introuvable.';
  if (status === 403) return "Vous n'avez pas accès à ce modèle.";
  return 'Détail indisponible pour le moment.';
};

export const NO_STEP_MESSAGE = 'Aucune étape dans ce modèle.';

/** role_id → nom en clair : libellé maison du code de rôle, sinon le nom renvoyé par le serveur. */
export const roleNamesById = (
  roles: readonly { id: number; code: string; name?: string | null }[],
): Record<number, string> => {
  const names: Record<number, string> = {};
  for (const role of roles) {
    const name = ROLE_HUMAN_LABEL[role.code] ?? role.name;
    if (name) names[role.id] = name;
  }
  return names;
};
