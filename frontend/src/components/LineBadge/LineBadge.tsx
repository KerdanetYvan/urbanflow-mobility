import './LineBadge.css';

interface LineBadgeProps {
  /** Mode OTP du segment (ex. "BUS", "TRAM") - determine la forme du badge. */
  mode: string;
  /** Numero/nom de la ligne a afficher dans le badge (ou libelle du mode en repli, voir tripModeChips.ts). */
  label: string;
  /** Couleur de fond propre a la ligne (GTFS route_color, deja prefixee '#' par toHexColor) - issue #129, section 8.4. */
  color?: string;
  /** Couleur de texte associee, pensee par l'operateur pour rester lisible sur `color` (GTFS route_text_color). */
  textColor?: string;
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
 * la ligne affiche a l'interieur. Fond colore avec la couleur propre a la
 * ligne (GTFS route_color/route_text_color, section 8.4) quand elle est
 * connue ; repli sur un style neutre sinon. Dans les deux cas, la forme et
 * le texte du badge restent le canal d'information independant de la
 * couleur (WCAG 1.4.1) - aucune vérification de contraste au runtime sur
 * la couleur GTFS, limite assumee (section 8.6).
 */
function LineBadge({ mode, label, color, textColor }: LineBadgeProps) {
  const shapeClass = LINE_BADGE_SHAPES[mode] ?? LINE_BADGE_SHAPES.BUS;
  // Fond plein uniquement si les DEUX couleurs sont connues (issue #129,
  // section 8.4) : un fond colore sans texte associe risquerait un
  // contraste non maitrise - repli sur les classes CSS neutres sinon.
  const coloredStyle =
    color && textColor
      ? { background: color, color: textColor, borderColor: color }
      : undefined;
  return (
    <span className={`line-badge ${shapeClass}`} style={coloredStyle}>
      {label}
    </span>
  );
}

export default LineBadge;
