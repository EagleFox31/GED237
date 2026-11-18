// frontend/lib/gedRulesTab.ts
//
// Lecture et écriture de l'onglet actif de `/rules` (`?tab=`) dans l'URL,
// avec repli sûr sur l'onglet par défaut (`categories`).

export type GedRulesTab = 'categories' | 'templates' | 'rules' | 'simulator';

export const DEFAULT_GED_RULES_TAB: GedRulesTab = 'categories';
export const GED_RULES_TAB_PARAM = 'tab';

const VALID_TABS = new Set<GedRulesTab>([
  'categories',
  'templates',
  'rules',
  'simulator',
]);

export function readGedRulesTab(params: URLSearchParams): GedRulesTab {
  const raw = (params.get(GED_RULES_TAB_PARAM) || '').trim() as GedRulesTab;
  return VALID_TABS.has(raw) ? raw : DEFAULT_GED_RULES_TAB;
}

export function writeGedRulesTab(
  current: URLSearchParams,
  tab: GedRulesTab,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (tab === DEFAULT_GED_RULES_TAB) {
    next.delete(GED_RULES_TAB_PARAM);
  } else {
    next.set(GED_RULES_TAB_PARAM, tab);
  }
  return next;
}
