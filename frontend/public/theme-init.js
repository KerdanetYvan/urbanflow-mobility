// Anti-FOUC du reglage de theme manuel (issue #245, voir src/lib/theme.ts) :
// pose `data-theme` sur <html> AVANT le premier paint. Extrait en fichier
// externe (audit securite OWASP #262) plutot qu'un <script> inline dans
// index.html : une Content-Security-Policy stricte (`script-src 'self'`,
// sans `'unsafe-inline'`) bloquerait silencieusement un script inline sans
// nonce/hash - un fichier `self` n'a pas ce probleme. Charge en
// <script src="/theme-init.js"> (pas type="module", qui serait differe) :
// rien n'a encore ete peint a ce stade, quel que soit l'endroit ou Vite
// injecte les <link rel="stylesheet"> au build.
//
// Logique dupliquee de `applyTheme` (src/lib/theme.ts) en JS brut a dessein :
// ce module ES n'est pas encore charge/execute a ce stade du parsing HTML -
// garder les deux synchronises si cette logique change. `try/catch` ici
// seulement (contrairement au reste du projet, voir le commentaire de
// lib/theme.ts) : une exception non rattrapee a ce stade bloquerait le
// parsing du reste du document, un risque que le reste de l'app (execute
// apres React, avec ses propres frontieres d'erreur) ne prend pas.
(function () {
  try {
    var pref = localStorage.getItem('urbanflow.theme.v1');
    if (pref === 'light' || pref === 'dark') {
      document.documentElement.setAttribute('data-theme', pref);
    }
  } catch (e) {
    // Navigation privee tres ancienne / localStorage indisponible :
    // repli silencieux sur le theme systeme, comportement historique.
  }
})();
