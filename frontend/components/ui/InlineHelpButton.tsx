import React from 'react';

import { Tooltip } from './Tooltip';

interface InlineHelpButtonProps {
  content: React.ReactNode;
  label: string;
  className?: string;
}

export const InlineHelpButton: React.FC<InlineHelpButtonProps> = ({
  content,
  label,
  className = '',
}) => (
  <Tooltip content={content}>
    <button
      type="button"
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rdpc-blue/40 hover:text-rdpc-blue ${className}`}
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden>help</span>
    </button>
  </Tooltip>
);
