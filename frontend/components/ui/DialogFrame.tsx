import React, { useRef } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface DialogFrameProps {
  /** Id of the visible title (aria-labelledby). */
  labelledBy: string;
  describedBy?: string;
  /** Must be stable (useCallback): a new function re-runs the focus effect. */
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Modal shell: dialog role, Escape closes, focus starts inside and Tab stays inside.
 * The panel scrolls on small screens so the action buttons stay reachable.
 * Mount it only while open (focus moves in on mount).
 */
export const DialogFrame: React.FC<DialogFrameProps> = ({ labelledBy, describedBy, onClose, className = '', children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(onClose, panelRef);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`relative w-full max-h-[calc(100vh-2rem)] overflow-y-auto ${className}`}
      >
        {children}
      </div>
    </div>
  );
};
