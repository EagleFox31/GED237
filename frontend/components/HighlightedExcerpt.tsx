import React from 'react';
import { hasHighlightMatch, parseHighlight } from '../lib/searchHighlight';

/** Extrait du contenu avec le mot trouvé surligné ; rien si l'extrait ne contient pas le mot. */
export const HighlightedExcerpt: React.FC<{ highlight?: string | null; className?: string }> = ({ highlight, className }) => {
  const parts = parseHighlight(highlight);
  if (!hasHighlightMatch(parts)) return null;
  return (
    <p data-testid="search-excerpt" className={className}>
      {parts.map((part, index) =>
        part.marked
          ? <mark key={index} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{part.text}</mark>
          : <React.Fragment key={index}>{part.text}</React.Fragment>,
      )}
    </p>
  );
};
