import { getModeStyle } from '../components/MapView/modeStyles';
import { toHexColor } from './color';
import type { TripItinerary } from './trips';

/**
 * Modes de transport "de ligne" (issue #129) - identifies par un numero/nom
 * de ligne (`TripSegment.routeName`), a la difference de la marche/velo/
 * trottinette/covoiturage qui restent representes par une icone generique.
 */
const LINE_MODES = new Set(['BUS', 'TRAM', 'RAIL', 'SUBWAY']);

/**
 * Indique si un mode de transport est identifie par une ligne (numero/nom,
 * `TripSegment.routeName`) plutot que par une icone generique - utilise par
 * `ItinerarySegments` (RecherchePageResults.tsx) et `MapView` (issue #129,
 * section 8.5) en plus de `tripModeChips()` ci-dessous, pour garder la meme
 * regle de decision "badge/trace de ligne vs icone/couleur de mode" partout.
 */
export function isLineMode(mode: string): boolean {
  return LINE_MODES.has(mode);
}

/**
 * Un element de la rangee de "puces" de mode affichee sur une carte
 * d'itineraire (issue #129) ou dans la legende de la carte (section 8.5) :
 * - `icon` : mode sans ligne identifiable (marche, velo, trottinette,
 *   covoiturage, ou tout mode non repertorie) - rendu via getTripModeIcon().
 * - `line` : mode de transport en commun - rendu via le composant LineBadge,
 *   `label` est le numero/nom de la ligne (ou le libelle du mode en repli
 *   si `routeName` n'est pas renseigne sur le segment). `color`/`textColor`
 *   (deja prefixes '#', voir toHexColor) viennent du GTFS operateur via
 *   `segment.routeColor`/`routeTextColor` - absents si l'operateur ne les
 *   definit pas, auquel cas les consommateurs retombent sur leur style
 *   neutre/par-mode habituel.
 */
export type TripModeChip =
  | { kind: 'icon'; mode: string }
  | { kind: 'line'; mode: string; label: string; color?: string; textColor?: string };

/**
 * Deduit, a partir des segments d'un itineraire, la liste ordonnee des
 * puces de mode a afficher sur sa carte-resume (ItineraryCard) ou la
 * legende de MapView (issue #129).
 *
 * Deduplique par (mode, libelle) pour les modes de ligne : deux segments Bus 24
 * consecutifs (ex. correspondance sans changement de ligne) ne produisent
 * qu'un seul badge, mais deux lignes de bus differentes (Bus 24 puis Bus C6)
 * produisent bien deux badges distincts, dans l'ordre du trajet. La couleur
 * du chip est celle du premier segment rencontre pour cette paire (les
 * segments d'une meme ligne partagent la meme couleur en pratique).
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
      chips.push({
        kind: 'line',
        mode: segment.mode,
        label,
        color: toHexColor(segment.routeColor),
        textColor: toHexColor(segment.routeTextColor),
      });
    } else {
      if (seen.has(segment.mode)) continue;
      seen.add(segment.mode);
      chips.push({ kind: 'icon', mode: segment.mode });
    }
  }

  return chips;
}

/**
 * Construit le libelle textuel complet d'une puce, pour l'affichage direct
 * (legende de MapView, section 7.5) ou pour un equivalent accessible WCAG
 * 1.1.1 (`modesLabel` de `RecherchePageResults.tsx`) - seul et unique
 * endroit qui doit faire ce calcul, pour eviter que deux copies independantes
 * du meme "mode + ligne" ne se remettent a diverger (issue #129).
 *
 * Un chip `line` contribue "libelle du mode + numero de ligne" (ex.
 * "Bus C1") ; SAUF si `chip.label` est deja le libelle du mode lui-meme
 * (repli de `tripModeChips()` ci-dessus quand `routeName` est absent du
 * segment) - dans ce cas precis, ne pas le repeter deux fois (ex. "Bus",
 * pas "Bus Bus"). Un chip `icon` contribue le libelle du mode seul (ex.
 * "Marche").
 *
 * @param chip Puce dont on derive le libelle complet.
 * @returns Le libelle a afficher pour cette puce.
 */
export function chipLabel(chip: TripModeChip): string {
  const modeLabel = getModeStyle(chip.mode).label;
  if (chip.kind === 'icon' || chip.label === modeLabel) return modeLabel;
  return `${modeLabel} ${chip.label}`;
}
