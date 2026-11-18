import React from 'react';
import { READ_STATE_LABEL, readStateOf } from '../lib/readStatus';

/** Pastille « Lecture en échec » / « Lecture en cours » ; rien si la lecture est normale. */
export const ReadStateBadge: React.FC<{ ocrStatus?: string | null; className?: string }> = ({ ocrStatus, className = '' }) => {
  const state = readStateOf(ocrStatus);
  if (state === 'none') return null;
  const tone = state === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return (
    <span data-testid="read-state" data-state={state} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone} ${className}`}>
      {READ_STATE_LABEL[state]}
    </span>
  );
};
