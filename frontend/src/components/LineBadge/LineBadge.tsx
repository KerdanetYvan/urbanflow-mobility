import './LineBadge.css';

interface LineBadgeProps {
  /** Mode OTP du segment (ex. "BUS", "TRAM") - determine la forme du badge. */
  mode: string;
  /** Numero/nom de la ligne a afficher dans le badge (ou libelle du mode en repli, voir tripModeChips.ts). */
  label: string;
}

/**
 * Classe de forme CSS par mode de transport en commun (issue #129) :
 * bus = rectangle a coins droits, tram = rectangle a coins arrondis,
 * metro = cercle, train = rectangle a coins coupes (voir LineBadge.css).
 * `bus` sert de repli si un mode de ligne non repertorie ici apparaissait un
 * jour (LINE_MODES dans tripModeChips.ts n'en connait que 4 aujourd'hui).
 */
const LINE_BADGE_SHAPES: Record<string, string> = {
  BUS: 'line-badge--bus',
  TRAM: 'line-badge--tram',
  SUBWAY: 'line-badge--metro',
  RAIL: 'line-badge--train',
};

/**
 * Badge de ligne de transport en commun (issue #129, docs/specs/
 * badges-lignes-transport.md) - remplace l'icone generique commune a BUS/
 * TRAM/RAIL/SUBWAY par une forme distincte par mode, avec le numero/nom de
 * la ligne affiche a l'interieur. Couleur neutre volontairement (voir la
 * spec section 4) : la forme et le texte suffisent a differencier les
 * lignes, sans dependre de la couleur (WCAG 1.4.1).
 */
function LineBadge({ mode, label }: LineBadgeProps) {
  const shapeClass = LINE_BADGE_SHAPES[mode] ?? LINE_BADGE_SHAPES.BUS;
  return <span className={`line-badge ${shapeClass}`}>{label}</span>;
}

export default LineBadge;
