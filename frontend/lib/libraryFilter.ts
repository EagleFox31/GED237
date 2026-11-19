// frontend/lib/libraryFilter.ts
import { getFileTypeLabel } from '../types';

export interface LibraryFilterCriteria {
  query: string;
  format: string;
  category: string;
}

export interface LibraryFilterableDoc {
  title?: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  category_name?: string | null;
}

export function extractLibraryFormats(docs: ReadonlyArray<LibraryFilterableDoc>): string[] {
  const formats = new Set<string>();
  for (const doc of docs) {
    const label = getFileTypeLabel((doc.mime_type || doc.file_type) ?? null);
    if (label) formats.add(label);
  }
  return Array.from(formats).sort();
}

export function extractLibraryCategories(docs: ReadonlyArray<LibraryFilterableDoc>): string[] {
  const categories = new Set<string>();
  for (const doc of docs) {
    const name = (doc.category_name || '').trim();
    if (name) categories.add(name);
  }
  return Array.from(categories).sort();
}

export function filterLibraryDocuments<T extends LibraryFilterableDoc>(
  docs: ReadonlyArray<T>,
  criteria: LibraryFilterCriteria,
): T[] {
  const needle = criteria.query.trim().toLowerCase();
  const wantedFormat = criteria.format.trim();
  const wantedCategory = criteria.category.trim();

  return docs.filter((doc) => {
    if (needle) {
      const titleMatch = (doc.title || '').toLowerCase().includes(needle);
      const catMatch = (doc.category_name || '').toLowerCase().includes(needle);
      if (!titleMatch && !catMatch) return false;
    }
    if (wantedFormat) {
      const label = getFileTypeLabel((doc.mime_type || doc.file_type) ?? null);
      if (label !== wantedFormat) return false;
    }
    if (wantedCategory && (doc.category_name || '').trim() !== wantedCategory) {
      return false;
    }
    return true;
  });
}
