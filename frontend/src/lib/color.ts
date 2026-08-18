/**
 * Prefixe '#' a une couleur hexadecimale brute (format renvoye par OTP/GTFS,
 * ex. "EE1D23") si necessaire - point unique de normalisation avant tout
 * usage CSS (issue #129, section 8.2 : le backend relaie la valeur brute
 * sans '#', c'est au frontend de la preparer pour l'affichage).
 *
 * @param value Couleur hexadecimale brute (avec ou sans '#'), ou absente.
 * @returns La couleur prefixee de '#', ou undefined si `value` est absente/vide.
 */
export function toHexColor(value?: string): string | undefined {
  if (!value) return undefined;
  return value.startsWith('#') ? value : `#${value}`;
}
