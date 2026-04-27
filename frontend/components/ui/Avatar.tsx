import React from 'react';
import { AVATAR_PALETTE } from '../../constants/roles';

const initialsOf = (name: string, matricule: string): string => {
  const src = (name || '').trim();
  if (src) {
    const parts = src.split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || matricule.slice(0, 2).toUpperCase();
  }
  return matricule.slice(0, 2).toUpperCase();
};

const colorFor = (key: string): string => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length] || AVATAR_PALETTE[0]!;
};

export const Avatar: React.FC<{ name: string; matricule: string; size?: 'sm' | 'md' }> = ({ name, matricule, size = 'md' }) => {
  const cls = colorFor(matricule || name);
  const dim = size === 'sm' ? 'w-8 h-8 text-[10px]' : 'w-10 h-10 text-xs';
  return (
    <div className={`${dim} ${cls} rounded-full flex items-center justify-center font-black tracking-wider flex-shrink-0`}>
      {initialsOf(name, matricule)}
    </div>
  );
};
