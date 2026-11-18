// frontend/lib/explorerSelection.ts

export interface SelectionState {
  selectedIds: string[];
  anchorId: string | null;
}

export interface SelectionInput {
  currentIds: string[];
  orderedIds: string[];
  anchorId: string | null;
  targetId: string;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export function applyExplorerSelection({
  currentIds,
  orderedIds,
  anchorId,
  targetId,
  ctrlKey,
  shiftKey,
}: SelectionInput): SelectionState {
  if (shiftKey) {
    const startId = anchorId && orderedIds.includes(anchorId) ? anchorId : targetId;
    const startIndex = orderedIds.indexOf(startId);
    const endIndex = orderedIds.indexOf(targetId);
    if (startIndex === -1 || endIndex === -1) {
      return { selectedIds: [targetId], anchorId: targetId };
    }
    const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    const rangeIds = orderedIds.slice(from, to + 1);
    if (ctrlKey) {
      const merged = new Set(currentIds);
      for (const id of rangeIds) merged.add(id);
      return { selectedIds: Array.from(merged), anchorId: startId };
    }
    return { selectedIds: rangeIds, anchorId: startId };
  }

  if (ctrlKey) {
    const exists = currentIds.includes(targetId);
    const nextIds = exists
      ? currentIds.filter((id) => id !== targetId)
      : [...currentIds, targetId];
    return { selectedIds: nextIds, anchorId: targetId };
  }

  return { selectedIds: [targetId], anchorId: targetId };
}

export function selectAllExplorerIds(orderedIds: string[]): SelectionState {
  return {
    selectedIds: [...orderedIds],
    anchorId: orderedIds[0] ?? null,
  };
}

export function formatSelectionCount(count: number): string {
  return `${count} sélectionné${count > 1 ? 's' : ''}`;
}

export interface BulkItemFailure {
  id: string;
  label: string;
  reason: string;
}

export interface BulkActionSummary {
  succeededIds: string[];
  failures: BulkItemFailure[];
}

export async function runBulkExplorerAction<T extends { id: string }>(
  items: T[],
  getLabel: (item: T) => string,
  action: (item: T) => Promise<void>,
): Promise<BulkActionSummary> {
  const succeededIds: string[] = [];
  const failures: BulkItemFailure[] = [];

  for (const item of items) {
    try {
      await action(item);
      succeededIds.push(item.id);
    } catch (err) {
      const reason = err instanceof Error && err.message.trim()
        ? err.message.trim()
        : 'Échec de l’opération';
      failures.push({ id: item.id, label: getLabel(item), reason });
    }
  }

  return { succeededIds, failures };
}

export function formatBulkSummaryMessage(
  actionVerb: string,
  summary: BulkActionSummary,
): string {
  const okCount = summary.succeededIds.length;
  const failCount = summary.failures.length;
  if (failCount === 0) {
    return `${okCount} ${actionVerb}${okCount > 1 ? 's' : ''}.`;
  }
  const failedList = summary.failures
    .map((f) => `${f.label} (${f.reason})`)
    .join(', ');
  if (okCount === 0) {
    return `${failCount} échec${failCount > 1 ? 's' : ''} : ${failedList}`;
  }
  return `${okCount} ${actionVerb}${okCount > 1 ? 's' : ''}, ${failCount} échec${failCount > 1 ? 's' : ''} : ${failedList}`;
}
