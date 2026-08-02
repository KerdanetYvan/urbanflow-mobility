/**
 * Decodeur du format "Encoded Polyline Algorithm" de Google (precision 5),
 * utilise par OpenTripPlanner pour `legGeometry.points` (issue #8) - le
 * trace detaille d'un segment d'itineraire, suivant les rues/voies
 * reellement parcourues plutot qu'une simple ligne droite entre ses deux
 * extremites.
 *
 * Algorithme public/standard (identique a celui de Google Maps), reimplemente
 * ici plutot que d'ajouter une dependance pour une trentaine de lignes -
 * verifie en session contre un vrai OTP et contre `@mapbox/polyline`
 * (implementation de reference) pour confirmer sa justesse.
 */
export function decodePolyline(
  encoded: string,
  precision = 5,
): { lat: number; lon: number }[] {
  const factor = Math.pow(10, precision);
  let index = 0;
  let lat = 0;
  let lon = 0;
  const coordinates: { lat: number; lon: number }[] = [];

  while (index < encoded.length) {
    lat += decodeSignedDelta();
    lon += decodeSignedDelta();
    coordinates.push({ lat: lat / factor, lon: lon / factor });
  }

  return coordinates;

  /**
   * Decode une seule valeur delta (variation de latitude OU de longitude
   * depuis le point precedent) : chaque caractere porte 5 bits de la valeur,
   * le bit de poids fort indiquant si un caractere supplementaire suit.
   */
  function decodeSignedDelta(): number {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    // Zigzag : un nombre impair encode une valeur negative.
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
}
