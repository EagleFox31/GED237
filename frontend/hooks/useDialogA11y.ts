import { useEffect } from 'react';
import type { RefObject } from 'react';

export const useDialogA11y = (onClose: () => void, openRef: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    const focusable = openRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    );
    focusable?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, openRef]);
};
