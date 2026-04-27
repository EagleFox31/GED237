import React from 'react';
import type { OrgUnitNode } from './types';

interface OrgChartProps {
  nodes: OrgUnitNode[];
  maxLevel?: number;
  onSelect?: (node: OrgUnitNode) => void;
  onAddChild?: (parent: OrgUnitNode) => void;
}

interface ChartNodeProps {
  node: OrgUnitNode;
  maxLevel?: number;
  onSelect?: (node: OrgUnitNode) => void;
  onAddChild?: (parent: OrgUnitNode) => void;
}

const ChartNode: React.FC<ChartNodeProps> = ({ node, maxLevel, onSelect, onAddChild }) => {
  const stop = maxLevel !== undefined && node.level >= maxLevel;
  const children = stop ? [] : node.children;
  const hasChildren = children.length > 0;

  return (
    <div className="inline-flex flex-col items-center align-top px-3">
      <button
        type="button"
        onClick={() => onSelect?.(node)}
        className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-rdpc-blue shadow-sm hover:shadow-md px-4 py-3 min-w-[180px] max-w-[220px] transition-all text-left"
      >
        <p className="text-[10px] font-black uppercase tracking-widest text-rdpc-blue font-mono">{node.code}</p>
        <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{node.name}</p>
        <p className="text-[10px] text-slate-400 mt-1">Niveau {node.level}</p>
        {onAddChild && (
          <span
            role="button"
            aria-label="Ajouter un sous-service"
            onClick={(e) => { e.stopPropagation(); onAddChild(node); }}
            className="absolute -bottom-2 -right-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-rdpc-blue text-white opacity-0 group-hover:opacity-100 hover:bg-blue-800 transition-all shadow"
          >
            <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          </span>
        )}
      </button>

      {hasChildren && (
        <>
          <div className="w-px h-5 bg-slate-300" />
          <div className="relative pt-5">
            {children.length > 1 && (
              <div className="absolute top-0 left-3 right-3 h-px bg-slate-300" />
            )}
            <div className="flex items-start justify-center">
              {children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  {children.length > 1 && (
                    <div className="absolute top-[-20px] left-1/2 w-px h-5 bg-slate-300" />
                  )}
                  <ChartNode
                    node={child}
                    maxLevel={maxLevel}
                    onSelect={onSelect}
                    onAddChild={onAddChild}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const OrgChart: React.FC<OrgChartProps> = ({ nodes, maxLevel, onSelect, onAddChild }) => (
  <div className="w-full overflow-auto rounded-2xl border border-slate-100 bg-slate-50/50" style={{ maxHeight: '65vh' }}>
    <div className="flex items-start justify-start gap-6 px-6 py-6" style={{ width: 'max-content', minWidth: '100%' }}>
      {nodes.map((node) => (
        <ChartNode
          key={node.id}
          node={node}
          maxLevel={maxLevel}
          onSelect={onSelect}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  </div>
);
