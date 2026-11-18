import React, { useState } from 'react';

import { api } from '../services/api';
import {
  canExpand,
  errorStatus,
  hierarchyErrorMessage,
  teamLevelLabel,
  teamToggleLabel,
  withoutAncestors,
  type HierarchyPerson,
} from '../lib/hierarchy';

interface TeamTreeProps {
  people: HierarchyPerson[];
  /** Niveau de `people` sous la personne de départ : 1 = équipe directe (N-1). */
  depth: number;
  /** Identifiants déjà affichés plus haut : une boucle de rattachement ne se redéplie pas. */
  ancestorIds: string[];
  renderName: (person: HierarchyPerson) => React.ReactNode;
}

type Branch =
  | { kind: 'closed' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'open'; team: HierarchyPerson[] };

const TeamNode: React.FC<{
  person: HierarchyPerson;
  depth: number;
  ancestorIds: string[];
  renderName: TeamTreeProps['renderName'];
}> = ({ person, depth, ancestorIds, renderName }) => {
  const [branch, setBranch] = useState<Branch>({ kind: 'closed' });
  const open = branch.kind !== 'closed';
  const panelId = `team-${person.id}`;

  const toggle = () => {
    if (open) {
      setBranch({ kind: 'closed' });
      return;
    }
    setBranch({ kind: 'loading' });
    api
      .getHierarchyDown(person.id)
      .then((team) => setBranch({ kind: 'open', team }))
      .catch((error: unknown) => setBranch({ kind: 'error', message: hierarchyErrorMessage(errorStatus(error), 'self') }));
  };

  return (
    <li className="py-2" data-testid="team-node" data-depth={depth}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        {canExpand(depth) && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={teamToggleLabel(person.full_name, open)}
            className="w-5 text-slate-500 hover:text-slate-800"
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
        )}
        {renderName(person)}
        <span className="text-slate-500">{person.matricule}</span>
        {person.role_label && <span className="text-slate-500">{person.role_label}</span>}
        {depth > 1 && <span className="text-xs text-slate-400">{teamLevelLabel(depth)}</span>}
      </div>
      <div id={panelId}>
        {branch.kind === 'loading' && <p className="ml-6 text-sm text-slate-500" role="status">Chargement…</p>}
        {branch.kind === 'error' && <p className="ml-6 text-sm text-amber-700" role="alert">{branch.message}</p>}
        {branch.kind === 'open' &&
          (branch.team.length === 0 ? (
            <p className="ml-6 text-sm text-slate-500">Personne ne lui rend compte.</p>
          ) : (
            <TeamTree
              people={branch.team}
              depth={depth + 1}
              ancestorIds={[...ancestorIds, person.id]}
              renderName={renderName}
            />
          ))}
      </div>
    </li>
  );
};

/** Équipe dépliable niveau par niveau : l'équipe d'une personne n'est lue qu'au clic. */
export const TeamTree: React.FC<TeamTreeProps> = ({ people, depth, ancestorIds, renderName }) => (
  <ul
    className={depth === 1 ? 'divide-y divide-slate-100 text-sm' : 'ml-6 border-l border-slate-200 pl-3 text-sm'}
    data-testid={depth === 1 ? 'reporting-team' : 'team-subtree'}
  >
    {withoutAncestors(people, ancestorIds).map((person) => (
      <TeamNode key={person.id} person={person} depth={depth} ancestorIds={ancestorIds} renderName={renderName} />
    ))}
  </ul>
);

export default TeamTree;
