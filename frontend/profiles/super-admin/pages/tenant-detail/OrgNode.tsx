import React, { useEffect, useState } from 'react';
import type { OrgUnitNode as OrgUnitNodeType } from './types';

interface OrgNodeProps {
  node: OrgUnitNodeType;
  depth?: number;
  /** When this changes, all nodes reset their open state to `forceOpen`. */
  resetSignal?: number;
  forceOpen?: boolean;
  /** Hide subtrees when node.level >= maxLevel. */
  maxLevel?: number;
  onAddChild?: (parent: OrgUnitNodeType) => void;
  onSelect?: (node: OrgUnitNodeType) => void;
}

export const OrgNode: React.FC<OrgNodeProps> = ({
  node,
  depth = 0,
  resetSignal = 0,
  forceOpen = true,
  maxLevel,
  onAddChild,
  onSelect,
}) => {
  const [open, setOpen] = useState(forceOpen);

  useEffect(() => {
    setOpen(forceOpen);
  }, [resetSignal, forceOpen]);

  const hasChildren = node.children.length > 0;
  const beyondLevel = maxLevel !== undefined && node.level >= maxLevel;
  const showChildren = hasChildren && open && !beyondLevel;

  return (
    <div className={depth > 0 ? 'ml-5 border-l-2 border-slate-100 pl-4' : ''}>
      <div
        className={`group flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
          onSelect ? 'cursor-pointer hover:bg-rdpc-blue/5' : 'hover:bg-rdpc-blue/5'
        }`}
        onClick={onSelect ? () => onSelect(node) : undefined}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) setOpen((v) => !v); }}
          aria-label={open ? 'Replier' : 'Déplier'}
          disabled={!hasChildren}
          className={`w-5 h-5 flex items-center justify-center rounded-md transition-all ${
            hasChildren ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700' : 'text-transparent pointer-events-none'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {hasChildren ? (open ? 'expand_more' : 'chevron_right') : 'remove'}
          </span>
        </button>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          depth === 0 ? 'bg-rdpc-blue/10 text-rdpc-blue' : 'bg-slate-100 text-slate-500'
        }`}>
          <span className="material-symbols-outlined text-lg">
            {depth === 0 ? 'account_tree' : 'corporate_fare'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{node.name}</p>
          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
            {node.code} · niveau {node.level}
          </p>
        </div>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:inline">
          {node.children.length} sous-service{node.children.length !== 1 ? 's' : ''}
        </span>
        {onAddChild && (
          <button
            type="button"
            title={`Ajouter un sous-service à ${node.name}`}
            aria-label={`Ajouter un sous-service à ${node.name}`}
            onClick={(e) => { e.stopPropagation(); onAddChild(node); }}
            className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-8 h-8 rounded-full text-rdpc-blue hover:bg-rdpc-blue hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-base">add</span>
          </button>
        )}
      </div>
      {showChildren && node.children.map((child) => (
        <OrgNode
          key={child.id}
          node={child}
          depth={depth + 1}
          resetSignal={resetSignal}
          forceOpen={forceOpen}
          maxLevel={maxLevel}
          onAddChild={onAddChild}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};
