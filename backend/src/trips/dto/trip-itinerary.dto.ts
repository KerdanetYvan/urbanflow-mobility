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
 * demandes) ne renvoie aucun itineraire (issue #190).
 *
 * - `walk-only` : aucun trajet en transport en commun a cette heure, mais un
 *   trajet a pied a ete trouve en re-interrogeant OTP en `mode=WALK` seul ;
 *   `TripSearchResult.itineraries` contient alors cet itineraire a pied.
 *
 * (Issue #91, tache suivante, ajoutera `later-departure` + des champs
 * `requestedDepartureTime` / `actualDepartureTime` pour le cas "prochain
 * creneau disponible plus tard".)
 */
export class TripFallback {
  @ApiProperty({ enum: ['walk-only'], example: 'walk-only' })
  kind: 'walk-only';
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
