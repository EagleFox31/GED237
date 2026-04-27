export { useDialogA11y } from '../../../../hooks/useDialogA11y';
export { parseApiError, errorMessage } from '../../../../utils/errors';

export const countOrgUnits = (nodes: { children: any[] }[]): number =>
  nodes.reduce((acc, n) => acc + 1 + countOrgUnits(n.children || []), 0);
