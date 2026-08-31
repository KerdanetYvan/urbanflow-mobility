/**
 * Forme (partielle) d'un résultat renvoyé par `GET {NOMINATIM_URL}/search`
 * avec `format=jsonv2&addressdetails=1` (issue #168, voir
 * docs/specs/nominatim-geocodage-adresses.md).
 *
 * Nominatim renvoie `lat`/`lon` en **chaînes** (pas des nombres) et un
 * `display_name` verbeux qu'on n'affiche jamais tel quel - le libellé court
 * est reconstruit à partir de `address` (voir NominatimClientService).
 */
export interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  /** La commune, sous l'un de ces noms selon le type d'entité OSM. */
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
}

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
  /** Type d'objet ('house', 'road', 'city', POI...) - utile pour affiner le libellé. */
  type?: string;
  addresstype?: string;
}
