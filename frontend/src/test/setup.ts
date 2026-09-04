// Execute automatiquement avant chaque fichier de test (voir "setupFiles"
// dans vite.config.ts). Ajoute les matchers jest-dom (toBeInTheDocument(),
// toHaveTextContent(), ...) a expect(), utilises dans les tests de composants.
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Remplace `localStorage` par une implementation en memoire fidele au Web
 * Storage API (issue #222).
 *
 * Node 22+ expose un accesseur global `localStorage` experimental (get/set
 * qui ne stockent rien sans le flag CLI `--localstorage-file`) - or
 * `globalThis === window` sous l'environnement jsdom de Vitest, donc jsdom
 * tente d'installer SA propre implementation en ecrivant dans le SETTER de
 * Node, qui ne persiste nulle part. Consequence sans ce correctif :
 * `localStorage.getItem/setItem/clear` renvoient `undefined`, `TypeError`
 * en cascade sur toute suite touchant `localStorage` (directement ou via
 * `authStorage.ts`/`AuthProvider`) - et le contournement precedemment
 * documente (`NODE_OPTIONS="--localstorage-file=..."`) introduisait a son
 * tour une fuite d'etat : ce flag backe `localStorage` par un fichier
 * SQLite partage par tout le process Vitest, donc entre fichiers de test
 * executes dans le meme run (contrairement a un vrai navigateur/jsdom, qui
 * isole chaque page).
 *
 * L'accesseur de Node est `configurable: true` (verifie en session) - donc
 * redefinissable ici avec une simple Map en memoire. Comportement aligne
 * sur un vrai navigateur : persiste pour la duree du FICHIER de test (pas
 * de reset automatique entre `it()` - aux tests eux-memes de nettoyer via
 * `clearTokens()`/`localStorage.clear()` s'ils en dependent, comme
 * aujourd'hui), repart a zero au fichier suivant (`setupFiles` s'execute
 * une fois par fichier) - jamais partage entre fichiers, contrairement au
 * contournement `--localstorage-file` ci-dessus.
 */
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

/**
 * jsdom (environnement de test de Vitest) n'implemente pas `window.matchMedia`
 * (contrairement a un vrai navigateur) - `TypeError: window.matchMedia is
 * not a function` des qu'un composant l'appelle (issue #245,
 * `useThemeSwitch`, qui suit `prefers-color-scheme` pour la position
 * initiale du switch de theme). Repli par defaut sur `matches: false` (theme
 * clair) : suffisant pour la quasi-totalite des tests, qui ne testent pas
 * une branche systeme-sombre specifique - `useThemeSwitch.spec.ts` surcharge
 * `matchMedia` localement (`vi.stubGlobal`) pour les scenarios ou la valeur
 * exacte importe. `addListener`/`removeListener` (API depreciee) inclus en
 * plus de `addEventListener`/`removeEventListener` : certaines libs/polyfills
 * y recourent encore, les deux ne coutent rien a stubber ici.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

/**
 * jsdom n'implemente pas non plus `ResizeObserver` (meme categorie de trou
 * que `matchMedia` ci-dessus) - `ReferenceError: ResizeObserver is not
 * defined` des que `AppLayout` (donc a peu pres tout arbre de test qui
 * passe par lui, `App.spec.tsx` compris) essaie de mesurer la hauteur
 * reelle de la nav mobile (issue #251). Stub minimal, sans callback reel :
 * `AppLayout` appelle deja sa mesure une fois de façon synchrone au
 * montage, independamment de l'observer - aucun test de ce projet ne
 * verifie un comportement declenche par un VRAI redimensionnement, seul
 * l'absence de crash au montage compte ici.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverStub,
});

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
