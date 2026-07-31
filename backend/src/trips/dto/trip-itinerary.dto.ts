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
