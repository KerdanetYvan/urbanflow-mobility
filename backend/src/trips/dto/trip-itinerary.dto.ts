import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Forme renvoyee par GET /trips (issue #7) - un itineraire multimodal decoupe en segments. */

export class TripPlace {
  @ApiProperty()
  name: string;

  @ApiProperty()
  lat: number;

  @ApiProperty()
  lon: number;
}

/** Un point du trace detaille d'un segment (voir TripSegment#geometry, issue #8) - pas de nom, contrairement a TripPlace. */
export class GeoPoint {
  @ApiProperty()
  lat: number;

  @ApiProperty()
  lon: number;
}

export class TripSegment {
  @ApiProperty({
    description:
      'Mode de transport du segment tel que renvoye par OTP (ex. "WALK", "BUS")',
  })
  mode: string;

  @ApiPropertyOptional({
    description: 'Nom de la ligne (ex. "T1") - absent pour un segment a pied',
  })
  routeName?: string;

  @ApiPropertyOptional({
    description:
      'Couleur de la ligne definie par l\'operateur GTFS (route_color), hexadecimal sans "#" - absente pour un segment a pied ou si l\'operateur ne la definit pas',
  })
  routeColor?: string;

  @ApiPropertyOptional({
    description:
      'Couleur de texte associee a routeColor (GTFS route_text_color), hexadecimal sans "#" - pensee par l\'operateur pour rester lisible sur routeColor',
  })
  routeTextColor?: string;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;

  @ApiProperty()
  durationSeconds: number;

  @ApiProperty()
  distanceMeters: number;

  @ApiProperty({ type: TripPlace })
  from: TripPlace;

  @ApiProperty({ type: TripPlace })
  to: TripPlace;

  @ApiProperty({
    type: GeoPoint,
    isArray: true,
    description:
      'Trace detaille du segment (suit les rues/voies parcourues), decode depuis le legGeometry renvoye par OpenTripPlanner (issue #8). Au moins 2 points (identiques a from/to si OTP ne fournit pas de trace pour ce segment).',
  })
  geometry: GeoPoint[];
}

export class TripItinerary {
  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;

  @ApiProperty()
  durationSeconds: number;

  @ApiProperty()
  transfers: number;

  @ApiProperty({ type: TripSegment, isArray: true })
  segments: TripSegment[];

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description:
      'Horaires de depart (ISO 8601, tries par ordre chronologique) de tous les itineraires strictement identiques (hors horaire) regroupes sous ce resultat (issue #127) - present uniquement quand au moins deux itineraires ont ete regroupes, absent sinon (pas de regroupement artificiel quand chaque itineraire renvoye par OTP est deja distinct). startTime correspond toujours au premier element de ce tableau.',
  })
  nextDepartures?: string[];
}

/**
 * Nature du repli quand la recherche "normale" (transports en commun + modes
 * demandes, a l'heure demandee) ne renvoie aucun itineraire.
 *
 * - `later-departure` (issue #91) : aucun trajet a l'heure demandee, mais un
 *   trajet existe plus tard (fenetre de recherche OTP elargie a 24h) ;
 *   `TripSearchResult.itineraries` contient ces trajets, `requestedDepartureTime`
 *   et `actualDepartureTime` disent de combien le creneau a glisse.
 * - `walk-only` (issue #190) : aucun trajet en transport en commun (meme
 *   plus tard), mais un trajet a pied a ete trouve en re-interrogeant OTP en
 *   `mode=WALK` seul ; `TripSearchResult.itineraries` contient cet itineraire
 *   a pied.
 */
export class TripFallback {
  @ApiProperty({
    enum: ['later-departure', 'walk-only'],
    example: 'later-departure',
  })
  kind: 'later-departure' | 'walk-only';

  @ApiPropertyOptional({
    description:
      'ISO 8601. Heure de depart demandee (ou "maintenant" resolu au moment de la recherche). Present uniquement pour kind="later-departure".',
  })
  requestedDepartureTime?: string;

  @ApiPropertyOptional({
    description:
      'ISO 8601. Heure de depart reelle du premier itineraire propose - posterieure a l\'heure demandee. Present uniquement pour kind="later-departure".',
  })
  actualDepartureTime?: string;
}

/**
 * Reponse de GET /trips (issue #7). Enveloppe plutot qu'un tableau nu
 * (issue #190) : le repli eventuel est une metadonnee sur la recherche, pas
 * un itineraire - un tableau ne peut pas la porter proprement.
 */
export class TripSearchResult {
  @ApiProperty({
    type: TripItinerary,
    isArray: true,
    description:
      'Itineraires trouves, deja tries par le backend. Vide = aucun itineraire (voir `fallback` pour savoir si un repli a ete tente).',
  })
  itineraries: TripItinerary[];

  @ApiPropertyOptional({
    type: TripFallback,
    description:
      "Present uniquement quand la recherche normale n'a rien renvoye ET qu'un repli a ete tente. Absent = resultats normaux, ou aucun repli disponible.",
  })
  fallback?: TripFallback;
}
