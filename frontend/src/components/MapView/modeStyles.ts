/**
 * Association mode de transport (tel que renvoye par OpenTripPlanner, ex.
 * "WALK", "BUS") -> couleur et libelle affiches sur la carte d'itineraire
 * (issue #8, voir MapView.tsx).
 *
 * Palette a 4 couleurs (hors marche, distinguee par un trait pointille
 * plutot qu'une 5e teinte) validee via le script du skill dataviz
 * (`validate_palette.js`) sur les deux themes (clair ET sombre, memes
 * valeurs hexadecimales dans les deux cas - verifie separement, voir la
 * discussion en session) : bande de luminosite, plancher de chroma,
 * separation daltonisme (CVD) et contraste vs fond de carte tous valides.
 * Un seul WARN subsiste (terracotta vs vert, ΔE daltonisme 6.3 - dans la
 * zone 6-8 legale uniquement si le mode n'est pas porte par la couleur
 * seule) : la legende sous la carte et le libelle affiche a cote de chaque
 * couleur servent de canal secondaire, comme l'exige le skill.
 *
 * Volontairement DIFFERENTE des tokens de charte graphique
 * (styles/tokens.css) : ce sont des couleurs categorielles de
 * visualisation de donnees (identite d'un mode de transport), pas des
 * couleurs d'interface - un usage distinct qui ne doit pas se caler sur les
 * memes contraintes que --color-primary/secondary/... (voir le skill
 * dataviz, "Assign color by the job it does").
 */
export interface ModeStyle {
  color: string;
  label: string;
  dashed?: boolean;
}

const DEFAULT_MODE_STYLE: ModeStyle = { color: '#6b6375', label: 'Autre' };

const MODE_STYLES: Record<string, ModeStyle> = {
  WALK: { color: '#6b6375', label: 'Marche', dashed: true },
  BICYCLE: { color: '#2f9e56', label: 'Vélo' },
  SCOOTER: { color: '#2f9e56', label: 'Trottinette' },
  CAR: { color: '#b4552a', label: 'Covoiturage' },
  BUS: { color: '#2f6fed', label: 'Bus' },
  TRAM: { color: '#2f6fed', label: 'Tram' },
  RAIL: { color: '#b23a8f', label: 'Train' },
  SUBWAY: { color: '#b23a8f', label: 'Métro' },
};

/** Style (couleur, libelle, pointille) pour un mode OTP donne - retombe sur un style neutre "Autre" pour un mode non repertorie. */
export function getModeStyle(mode: string): ModeStyle {
  return MODE_STYLES[mode] ?? DEFAULT_MODE_STYLE;
}
