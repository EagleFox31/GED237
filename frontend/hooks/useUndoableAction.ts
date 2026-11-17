import { useCallback, useEffect, useRef, useState } from 'react';

import { isEditableTarget } from '../profiles/tenant-admin/pages/explorerKeys';

/** Durée pendant laquelle « Annuler » reste proposé (décision PO #151). */
export const UNDO_WINDOW_MS = 10_000;

export type UndoOffer = {
  id: number;
  message: string;
  /** Absent : simple information, sans bouton « Annuler ». */
  undo?: () => Promise<void>;
};

/**
 * Dernière action annulable, façon Gmail : un seul niveau, pas d'historique.
 * Ctrl+Z (ou Cmd+Z) annule tant que le message est visible, sauf dans un champ de saisie.
 */
export function useUndoableAction(windowMs = UNDO_WINDOW_MS) {
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const seq = useRef(0);

  const propose = useCallback((message: string, undo?: () => Promise<void>) => {
    seq.current += 1;
    setOffer({ id: seq.current, message, undo });
  }, []);

  const dismiss = useCallback(() => setOffer(null), []);

  const runUndo = useCallback(async () => {
    const current = offer;
    if (!current?.undo) return;
    setOffer(null);
    try {
      await current.undo();
    } catch {
      /* message déjà affiché par le bus global */
    }
  }, [offer]);

  useEffect(() => {
    if (!offer) return undefined;
    const timer = window.setTimeout(() => setOffer((o) => (o?.id === offer.id ? null : o)), windowMs);
    return () => window.clearTimeout(timer);
  }, [offer, windowMs]);

  useEffect(() => {
    if (!offer?.undo) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'z' || isEditableTarget(event.target)) return;
      event.preventDefault();
      void runUndo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [offer, runUndo]);

  return { offer, propose, dismiss, runUndo };
}
