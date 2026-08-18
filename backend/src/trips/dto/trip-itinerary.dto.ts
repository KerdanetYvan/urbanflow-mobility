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
}
