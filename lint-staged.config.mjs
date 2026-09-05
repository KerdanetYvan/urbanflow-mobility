import path from 'node:path';

// Config lint-staged (issue #269, dossier partie 6.1 - "hook local a chaque
// commit", jusqu'ici seulement vrai en CI). Pas de workspace npm : frontend/
// et backend/ restent deux projets independants, chacun avec son propre
// ESLint installe et sa propre config flat (eslint.config.*) - impossible
// de simplement lancer `eslint` depuis la racine du repo (rien n'y est
// installe, et aucun eslint.config.* n'y vit).
//
// lint-staged (depuis la v13) execute les commandes SANS vrai shell
// (execa avec shell:false) - `cd backend && npx eslint ...` echoue donc ici
// (`&&` n'a aucun sens hors d'un shell, vecu en session avec l'erreur
// Windows "Le chemin d'acces specifie est introuvable"). Solution : invoquer
// directement `node <chemin-absolu-vers-eslint.js> --config <chemin-absolu-
// vers-eslint.config.*>` sur les fichiers STAGES en chemin absolu (deja le
// format fourni par lint-staged) - fonctionne quel que soit le cwd du
// process lance, pas besoin de changer de repertoire.
//
// Attention en editant ce fichier : ne jamais ecrire un glob contenant
// litteralement une sequence "etoile-etoile-slash" (deux etoiles suivies
// d'un slash) DANS un commentaire de bloc /* */ - cette sequence est aussi
// le marqueur de FIN de commentaire (vecu en session, "Unexpected token
// '*'" a l'execution). D'ou des commentaires de ligne (//) ici plutot que
// des blocs /** */, qui n'ont pas ce probleme.
function scopedEslintFix(projectDir, configFileName) {
  const projectAbs = path.resolve(projectDir);
  const eslintBin = path.join(
    projectAbs,
    'node_modules',
    'eslint',
    'bin',
    'eslint.js',
  );
  const configPath = path.join(projectAbs, configFileName);

  return (absoluteFiles) => {
    if (absoluteFiles.length === 0) return [];

    return [
      [
        'node',
        JSON.stringify(eslintBin),
        '--config',
        JSON.stringify(configPath),
        '--fix',
        ...absoluteFiles.map((f) => JSON.stringify(f)),
      ].join(' '),
    ];
  };
}

export default {
  'frontend/**/*.{ts,tsx}': scopedEslintFix('frontend', 'eslint.config.js'),
  'backend/**/*.ts': scopedEslintFix('backend', 'eslint.config.mjs'),
};
