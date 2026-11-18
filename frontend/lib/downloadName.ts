// Nom du fichier téléchargé : « titre.extension ». Le contenu est récupéré en blob, donc le nom ne vient pas
// de l'en-tête Content-Disposition ; on le reconstruit depuis le titre et le type du document.

const extensionOf = (path?: string | null): string => {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(path ?? '');
  return m?.[1]?.toLowerCase() ?? '';
};

export const downloadName = (doc: { title?: string | null; file_type?: string | null; file_path?: string | null }): string => {
  const title = (doc.title ?? '').trim() || 'document';
  const ext = (doc.file_type ?? '').replace(/^\./, '').toLowerCase() || extensionOf(doc.file_path);
  if (!ext || title.toLowerCase().endsWith(`.${ext}`)) return title;
  return `${title}.${ext}`;
};
