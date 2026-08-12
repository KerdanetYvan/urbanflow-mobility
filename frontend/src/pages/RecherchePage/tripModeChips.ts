import { getModeStyle } from '../../components/MapView/modeStyles';
import type { TripItinerary } from '../../lib/trips';

/**
 * Modes de transport "de ligne" (issue #129) - identifies par un numero/nom
 * de ligne (`TripSegment.routeName`), a la difference de la marche/velo/
 * trottinette/covoiturage qui restent representes par une icone generique.
 */
const LINE_MODES = new Set(['BUS', 'TRAM', 'RAIL', 'SUBWAY']);

/**
 * Un element de la rangee de "puces" de mode affichee sur une carte
 * d'itineraire (issue #129) :
 * - `icon` : mode sans ligne identifiable (marche, velo, trottinette,
 *   covoiturage, ou tout mode non repertorie) - rendu via getTripModeIcon().
 * - `line` : mode de transport en commun - rendu via le composant LineBadge,
 *   `label` est le numero/nom de la ligne (ou le libelle du mode en repli
 *   si `routeName` n'est pas renseigne sur le segment).
 */
export type TripModeChip =
  | { kind: 'icon'; mode: string }
  | { kind: 'line'; mode: string; label: string };

/**
 * Deduit, a partir des segments d'un itineraire, la liste ordonnee des
 * puces de mode a afficher sur sa carte-resume (ItineraryCard) ou son
 * apercu compact (CompactPreview) - remplace modesUsedBy() (RecherchePageResults.tsx),
 * qui dedupliquait par mode seul et perdait donc l'information de ligne.
 *
 * Deduplique par (mode, libelle) pour les modes de ligne : deux segments Bus 24
 * consecutifs (ex. correspondance sans changement de ligne) ne produisent
 * qu'un seul badge, mais deux lignes de bus differentes (Bus 24 puis Bus C6)
 * produisent bien deux badges distincts, dans l'ordre du trajet.
 *
 * @param itinerary Itineraire dont on derive la rangee de puces.
 * @returns La liste ordonnee des puces (icone ou ligne), une entree par mode/ligne distincts.
 */
export function tripModeChips(itinerary: TripItinerary): TripModeChip[] {
  const chips: TripModeChip[] = [];
  // Cle de dedup deja vue : le mode seul pour un chip icone, "mode:libelle"
  // pour un chip ligne (deux modes de ligne differents utilisant le meme
  // libelle, improbable mais possible, restent bien distingues par le mode).
  const seen = new Set<string>();

  for (const segment of itinerary.segments) {
    if (LINE_MODES.has(segment.mode)) {
      const label = segment.routeName ?? getModeStyle(segment.mode).label;
      const key = `${segment.mode}:${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push({ kind: 'line', mode: segment.mode, label });
    } else {
      if (seen.has(segment.mode)) continue;
      seen.add(segment.mode);
      chips.push({ kind: 'icon', mode: segment.mode });
    }
  }

  return chips;
}
