// Execute automatiquement avant chaque fichier de test (voir "setupFiles"
// dans vite.config.ts). Ajoute les matchers jest-dom (toBeInTheDocument(),
// toHaveTextContent(), ...) a expect(), utilises dans les tests de composants.
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Demonte l'arbre React rendu apres chaque test. @testing-library/react
// enregistre normalement ce cleanup automatiquement quand `globals: true`,
// mais la detection est prise en defaut dans cet environnement (Vitest 4) :
// sans ce afterEach explicite, les arbres s'accumulent d'un test a l'autre
// dans le meme fichier (deux <App/> montes en meme temps -> `getBy*` casse
// sur "found multiple", navigations qui se marchent dessus). Idempotent :
// un double appel a cleanup() est sans effet.
afterEach(() => {
  cleanup();
});
