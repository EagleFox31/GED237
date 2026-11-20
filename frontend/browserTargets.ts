// Navigateurs minimaux pris en charge, fixés explicitement. Ce sont les valeurs par défaut de
// Vite 6 (« modules »), écrites en clair pour qu'une mise à jour de Vite ne les relève pas sans qu'on le voie.
// Les postes sous Windows 7 restent bloqués sur Chrome 109 et Firefox 115 ESR : ils doivent
// rester au-dessus de ce plancher.
// Vite (build.target) lit cette liste. `.browserslistrc` la recopie pour l'autoprefixer, et le
// spec e2e/unit/legacy-browsers.spec.ts vérifie que les deux restent alignés.
export const BROWSER_TARGETS = ['chrome87', 'edge88', 'firefox78', 'safari14'];
