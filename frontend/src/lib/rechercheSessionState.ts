import type { PlaceSuggestion } from './places';
import type { TripFallback, TripItinerary } from './trips';

/**
 * Persistance de la recherche en cours sur /recherche entre deux
 * navigations (issue #266) : RecherchePage.tsx garde tout son etat en
 * `useState` local, demonte par React des qu'on quitte la route (ex. clic
 * sur "Profil" dans la nav) - sans ceci, revenir sur /recherche repart d'un
 * formulaire vide, meme si une recherche (et ses resultats) etait deja en
 * cours.
 *
 * `sessionStorage` (pas `localStorage`, contrairement a tripCache.ts) :
 * cette recherche contient des coordonnees de geolocalisation (origine/
 * destination), sensibles au meme titre - mais le besoin exprime est
 * seulement "je change de page et je reviens", pas "je veux la retrouver
 * demain". sessionStorage s'efface automatiquement a la fermeture de
 * l'onglet, sans TTL a gerer manuellement - minimisation par construction,
 * plus stricte que tripCache (24h) pour un usage qui n'en a pas besoin.
 *
 * Purge a la deconnexion (voir lib/auth.ts#logout), meme raisonnement que
 * tripCache.ts : un appareil partage ne doit pas laisser la prochaine
 * session lire la recherche du precedent utilisateur.
 */

const STORAGE_KEY = 'urbanflow.rechercheSession.v1';

/** Etat d'un champ origine/destination - duplique de RecherchePage.tsx (AddressFieldState) plutot qu'importe : ce module ne doit pas dependre d'un composant de page. */
export interface AddressFieldState {
  query: string;
  selected: PlaceSuggestion | null;
}

/**
 * Sous-ensemble du type `Screen` de RecherchePage.tsx qui a du sens a
 * restaurer - l'etat "recherche" (requete en vol) est volontairement exclu
 * : un appel interrompu par une navigation ne doit pas revenir "coince en
 * chargement" indefiniment au retour sur la page (voir
 * saveRechercheSessionState ci-dessous, qui ne persiste jamais cet etat).
 */
export type PersistedScreen =
  | { kind: 'formulaire' }
  | {
      kind: 'resultats';
      origin: PlaceSuggestion;
      destination: PlaceSuggestion;
      itineraries: TripItinerary[];
      fallback?: TripFallback;
      fromCache?: boolean;
    };

export interface RechercheSessionState {
  screen: PersistedScreen;
  origin: AddressFieldState;
  destination: AddressFieldState;
  departureTime: string;
  selectedModes: string[];
}

/**
 * Enregistre l'etat courant de la recherche. Jamais d'exception (quota
 * depasse, sessionStorage indisponible en navigation privee tres
 * ancienne...) - degrade en silence, ce n'est qu'un confort de continuite
 * entre deux pages, jamais une fonctionnalite bloquante.
 */
export function saveRechercheSessionState(state: RechercheSessionState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Voir le commentaire de la fonction.
  }
}

/**
 * Relit l'etat sauvegarde, `null` si absent ou illisible (JSON corrompu,
 * ancienne version de ce format...) - jamais d'exception propagee, un
 * probleme ici doit degrader vers un formulaire vide, pas casser le
 * montage de RecherchePage.
 */
export function loadRechercheSessionState(): RechercheSessionState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RechercheSessionState;
  } catch {
    return null;
  }
}

/** Purge la recherche persistee (deconnexion/suppression de compte - voir lib/auth.ts). */
export function clearRechercheSessionState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Voir le commentaire de saveRechercheSessionState.
  }
}
