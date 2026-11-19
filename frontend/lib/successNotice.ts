// Confirmations vertes après une action clé (dépôt, soumission, décision) : l'utilisateur sait que
// c'est fait et ne redépose pas en double. Pendant du bus d'erreurs (lib/errors), gardé à part :
// une réussite n'est ni une erreur ni une information à acquitter.
import { create } from 'zustand';

/** Durée d'affichage : assez pour lire une phrase courte (WCAG 2.2.1 : fermeture manuelle possible). */
export const SUCCESS_NOTICE_MS = 5_000;
/** Au-delà, la plus ancienne confirmation laisse sa place. */
export const SUCCESS_NOTICE_MAX = 3;

export interface SuccessNotice {
  id: number;
  message: string;
}

/** Ajoute une confirmation : un même message déjà affiché n'est pas répété, la liste reste bornée. */
export function appendNotice(list: SuccessNotice[], notice: SuccessNotice, max = SUCCESS_NOTICE_MAX): SuccessNotice[] {
  if (list.some((n) => n.message === notice.message)) return list;
  return [...list, notice].slice(-max);
}

/** Texte de la confirmation après une décision sur une étape de circuit. */
export function decisionNotice(decision: 'accept' | 'reject', actionType?: string): string {
  if (decision === 'reject') return 'Rejet envoyé : le rédacteur verra votre motif.';
  switch (actionType) {
    case 'visa': return 'Document visé.';
    case 'approval': return 'Document approuvé.';
    case 'final_signature': return 'Document signé.';
    case 'read_ack': return 'Lecture confirmée.';
    default: return 'Document validé.';
  }
}

interface SuccessNoticeState {
  notices: SuccessNotice[];
  dismiss: (id: number) => void;
}

export const useSuccessNotices = create<SuccessNoticeState>((set) => ({
  notices: [],
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));

let seq = 0;

/** Affiche une confirmation verte, fermée seule après SUCCESS_NOTICE_MS. */
export function pushSuccess(message: string): void {
  seq += 1;
  const id = seq;
  useSuccessNotices.setState((s) => ({ notices: appendNotice(s.notices, { id, message }) }));
  setTimeout(() => useSuccessNotices.getState().dismiss(id), SUCCESS_NOTICE_MS);
}
