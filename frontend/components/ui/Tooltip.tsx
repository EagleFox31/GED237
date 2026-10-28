import React from 'react';

interface TooltipProps {
  content?: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
  align?: 'left' | 'center' | 'right';
  className?: string;
}

const SIDE_CLASS: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
};

const ALIGN_CLASS: Record<NonNullable<TooltipProps['align']>, string> = {
  left: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-0',
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  align = 'center',
  className = '',
}) => {
  if (!content) {
    return <>{children}</>;
  }

  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden max-w-[280px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium leading-5 text-slate-600 shadow-xl group-hover:block group-focus-within:block ${SIDE_CLASS[side]} ${ALIGN_CLASS[align]}`}
      >
        {content}
      </span>
    </span>
  );
};
