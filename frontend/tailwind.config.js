import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  // Dossiers explicites : un glob « ./**/* » parcourrait node_modules.
  content: [
    './index.html',
    './*.{ts,tsx}',
    './{components,profiles,constants,content,hooks,lib,services,stores,utils}/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#13ec5b',
        'primary-hover': '#0fd652',
        'background-light': '#f6f8f6',
        'background-dark': '#102216',
        'cam-green': '#007A5E',
        'cam-red': '#CE1126',
        'cam-yellow': '#FCD116',
        'rdpc-blue': '#0055A4',
      },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem', full: '9999px' },
    },
  },
  plugins: [forms, containerQueries],
};
