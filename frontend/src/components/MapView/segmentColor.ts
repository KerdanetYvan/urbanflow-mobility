import { isLineMode } from '../../lib/tripModeChips';
import { toHexColor } from '../../lib/color';
import type { TripSegment } from '../../lib/trips';
import { getModeStyle } from './modeStyles';

/**
 * Couleur a appliquer au trace d'un segment sur la carte (issue #129,
 * section 8.5) : la couleur propre a la ligne (GTFS route_color) pour un
 * segment de transport en commun quand elle est connue, sinon la couleur de
 * repli par mode (modeStyles.ts) - meme repli pour les segments sans notion
 * de ligne (marche, velo, trottinette, covoiturage).
 *
 * @param segment Segment dont on derive la couleur de trace.
 * @returns Une couleur CSS prete a l'emploi (toujours prefixee '#').
 */
export function getSegmentColor(segment: TripSegment): string {
  const modeColor = getModeStyle(segment.mode).color;
  if (!isLineMode(segment.mode)) return modeColor;
  return toHexColor(segment.routeColor) ?? modeColor;
}
