import { API_URL } from '../constants';
import { fetchWithRefresh, getHeaders } from './http/client';
import { DocumentCategory, DocumentCategoryCreate } from '../types';
export type { DocumentCategory, DocumentCategoryCreate };

export const categoriesApi = {
  list: async (includeInactive: boolean = false): Promise<DocumentCategory[]> => {
    const query = includeInactive ? '?include_inactive=true' : '';
    const response = await fetchWithRefresh(`${API_URL}/categories${query}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  },

  create: async (data: DocumentCategoryCreate): Promise<DocumentCategory> => {
    const response = await fetchWithRefresh(`${API_URL}/categories/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        let payload: any = null;
        try { payload = await response.json(); } catch {}
        throw { status: response.status, payload };
    }
    return response.json();
  },

  update: async (id: string, data: Partial<DocumentCategoryCreate>): Promise<DocumentCategory> => {
    const response = await fetchWithRefresh(`${API_URL}/categories/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update category');
    return response.json();
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetchWithRefresh(`${API_URL}/categories/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete category');
  }
};
