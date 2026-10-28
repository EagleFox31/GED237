import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface MultiCheckOption {
  value: string;
  label: string;
}

export interface MultiCheckSelectProps {
  options: MultiCheckOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Couleur d'accent Tailwind (ex: 'rdpc-blue', 'emerald-500'). */
  accent?: string;
  /** Désactive le champ. */
  disabled?: boolean;
  /** Recherche locale dans les options. */
  searchable?: boolean;
  ariaLabel?: string;
}

/**
 * Sélection multiple par cases à cocher.
 * - Bouton refermé : affiche le résumé (« Tous » / « Devis » / « Devis +2 »)
 * - Ouvert : panneau scrollable avec checkbox par option, recherche optionnelle.
 *
 * Tolère les IDs orphelins (sélectionnés mais plus dans options) :
 * affichés comme « (élément supprimé) » et désélectionnables individuellement.
 */
export const MultiCheckSelect: React.FC<MultiCheckSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder = 'Aucun',
  accent = 'rdpc-blue',
  disabled = false,
  searchable = true,
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.document.addEventListener('mousedown', handler);
    return () => window.document.removeEventListener('mousedown', handler);
  }, [open]);

  const indexedOptions = useMemo(() => {
    const map = new Map<string, string>();
    options.forEach((opt) => map.set(opt.value, opt.label));
    return map;
  }, [options]);

  const summary = useMemo(() => {
    if (selected.length === 0) return placeholder;
    const labels = selected.map((id) => indexedOptions.get(id) ?? '(élément supprimé)');
    if (labels.length === 1) return labels[0];
    return `${labels[0]} +${labels.length - 1}`;
  }, [selected, indexedOptions, placeholder]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  const orphanIds = useMemo(
    () => selected.filter((id) => !indexedOptions.has(id)),
    [selected, indexedOptions],
  );

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((id) => id !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-${accent} disabled:opacity-50 flex items-center justify-between gap-2 text-left`}
      >
        <span className={selected.length === 0 ? 'text-slate-400 font-medium' : ''}>
          {summary}
        </span>
        <span className="material-symbols-outlined text-base text-slate-400 shrink-0">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-2 w-full max-h-72 overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-xl flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-slate-100 shrink-0">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none"
                aria-label="Rechercher dans les options"
              />
            </div>
          )}
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <p className="text-xs italic text-slate-400 text-center py-4 px-3">
                Aucune option ne correspond.
              </p>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${checked ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      className={`w-4 h-4 rounded border-slate-300 text-${accent} focus:ring-${accent}`}
                    />
                    <span className="text-sm font-medium text-slate-700 flex-1">
                      {opt.label}
                    </span>
                  </label>
                );
              })
            )}
            {orphanIds.length > 0 && (
              <div className="border-t border-rose-100 bg-rose-50/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 px-3 pt-2">
                  Éléments supprimés
                </p>
                {orphanIds.map((id) => (
                  <label
                    key={id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-rose-50"
                  >
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggle(id)}
                      className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs italic text-rose-700 flex-1">
                      Référence supprimée — décocher pour nettoyer
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest shrink-0">
            <span className="text-slate-400">{selected.length} sélectionné{selected.length > 1 ? 's' : ''}</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-slate-500 hover:text-rose-600 transition-colors"
              >
                Tout désélectionner
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
