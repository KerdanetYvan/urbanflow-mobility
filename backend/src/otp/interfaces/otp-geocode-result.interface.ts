/**
 * Forme d'un resultat renvoye par `GET {OTP_URL}/geocode?query=...`
 * (fonctionnalite sandbox d'OTP, activee via routing-engine/otp-config.json
 * - voir issue #81). Note : OTP utilise `lng`, pas `lon` comme le reste de
 * son API REST (`/plan`) - incoherence propre a OTP, pas a reproduire cote
 * PlacesService.
 */
export interface OtpGeocodeResult {
  lat: number;
  lng: number;
  description: string;
  id: string;
}
