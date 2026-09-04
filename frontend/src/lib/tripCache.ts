import type { PlaceSuggestion } from './places';
import type { TripSearchResult } from './trips';

/**
 * Cache local des derniers trajets utiles (F2, issue #10 - "mode dégradé") :
 * permet de retrouver les résultats d'une recherche récente quand une
 * nouvelle recherche échoue faute de connexion, plutôt qu'un écran vide.
 * `localStorage` (pas IndexedDB) : quelques itinéraires JSON, volume trop
 * modeste pour justifier une base transactionnelle - même choix que
 * `authStorage.ts` pour les jetons.
 *
 * RGPD (CLAUDE.md - "durée de vie limitée du cache local côté PWA",
 * docs/specs/rgpd-geolocalisation.md section 3.3) : origine/destination
 * sont des coordonnées de géolocalisation, sensibles au même titre que
 * `TripHistoryEntry` (backend) - mais **pas chiffrées ici** contrairement à
 * cette dernière. Un chiffrement côté navigateur avec une clé embarquée
 * dans le bundle JS n'offre aucune protection réelle contre le seul
 * "attaquant" pertinent pour du stockage local (l'utilisateur de l'appareil
 * lui-même, ou quiconque y a déjà accès) - contrairement à une base serveur
 * dont un dump/backup peut fuiter indépendamment de l'utilisateur. La
 * mitigation qui compte réellement ici, et que CLAUDE.md cite d'ailleurs
 * séparément du chiffrement, est la **minimisation** : peu d'entrées, purge
 * automatique courte (voir RETENTION_MS) - appliquée à chaque lecture ET
 * écriture, sans tâche de fond dédiée.
 *
 * Volontairement distinct de `TripHistoryEntry` (backend, issue #11,
 * rétention 12 mois) : deux fonctions différentes - l'historique sert des
 * raccourcis de recherche pour un compte connecté, ce cache sert la
 * résilience hors-ligne pour n'importe quel usager (y compris anonyme,
 * cohérent avec la recherche utilisable sans compte, issue #64) sur une
 * fenêtre bien plus courte.
 */

const STORAGE_KEY = 'urbanflow.tripCache.v1';
/** Nombre maximum d'entrees conservees - meme ordre de grandeur que les autres listes "recentes" de l'app (ex. adresses recentes du dropdown, issue #166). */
const MAX_ENTRIES = 5;
/** Fenetre de retention (24h) : un trajet en cache au-dela n'est plus "utile" (horaires/perturbations perimes) - bien plus courte que les 12 mois de TripHistoryEntry, qui sert un usage different. */
const RETENTION_MS = 24 * 60 * 60 * 1000;

export interface CachedTrip {
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
  result: TripSearchResult;
  /** ISO 8601 - moment de la mise en cache, utilise pour la purge (RETENTION_MS). */
  cachedAt: string;
}

/** Deux lieux sont le "meme" trajet si leurs coordonnees coincident - le libelle peut varier (ex. reformulation du geocodeur) sans que ce soit un trajet different. */
function samePlace(a: PlaceSuggestion, b: PlaceSuggestion): boolean {
  return a.lat === b.lat && a.lon === b.lon;
}

function isExpired(entry: CachedTrip, now: number): boolean {
  return now - new Date(entry.cachedAt).getTime() > RETENTION_MS;
}

/** Lit le cache brut, jamais d'exception (quota depasse, JSON corrompu, localStorage indisponible en navigation privee...) - degrade en cache vide plutot que de faire echouer l'ecran de recherche. */
function readAll(): CachedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedTrip[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: CachedTrip[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota depasse ou stockage indisponible : le cache est un confort de
    // mode degrade, jamais une fonctionnalite bloquante - on abandonne
    // silencieusement cette ecriture plutot que de faire echouer la
    // recherche qui vient de reussir.
  }
}

/**
 * Enregistre le resultat d'une recherche reussie (issue #10). Upsert par
 * (origine, destination) - une recherche repetee sur le meme trajet met a
 * jour l'entree existante (plus recente) plutot que d'en accumuler une
 * seconde. Purge les entrees expirees au passage, puis plafonne a
 * MAX_ENTRIES (la plus ancienne cede la place).
 */
export function saveTripToCache(
  origin: PlaceSuggestion,
  destination: PlaceSuggestion,
  result: TripSearchResult,
): void {
  const now = Date.now();
  const withoutExpiredOrSameTrip = readAll().filter(
    (entry) =>
      !isExpired(entry, now) &&
      !(samePlace(entry.origin, origin) && samePlace(entry.destination, destination)),
  );
  const entries = [
    { origin, destination, result, cachedAt: new Date(now).toISOString() },
    ...withoutExpiredOrSameTrip,
  ].slice(0, MAX_ENTRIES);
  writeAll(entries);
}

/**
 * Retrouve un trajet en cache pour cette origine/destination exacte (issue
 * #10) - `null` si absent ou expire. Purge les entrees expirees au passage
 * (pas de tache de fond dediee, voir la docstring en tete de fichier).
 */
export function getCachedTrip(
  origin: PlaceSuggestion,
  destination: PlaceSuggestion,
): CachedTrip | null {
  const now = Date.now();
  const all = readAll();
  const valid = all.filter((entry) => !isExpired(entry, now));
  if (valid.length !== all.length) writeAll(valid);

  return (
    valid.find(
      (entry) =>
        samePlace(entry.origin, origin) && samePlace(entry.destination, destination),
    ) ?? null
  );
}

/**
 * Purge le cache (audit securite OWASP #262 - deconnexion/suppression de
 * compte, voir auth.ts#logout et #deleteAccount). Ce cache reste utilisable
 * sans compte par conception (issue #64), mais une deconnexion EXPLICITE
 * est le signal le plus net qu'un autre usager va potentiellement utiliser
 * le meme appareil ensuite - sans cette purge, les dernieres origines/
 * destinations (coordonnees GPS, potentiellement domicile/travail)
 * resteraient lisibles jusqu'a expiration naturelle (RETENTION_MS, 24h).
 */
export function clearTripCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage indisponible (navigation privee tres ancienne) : rien a purger.
  }
}
