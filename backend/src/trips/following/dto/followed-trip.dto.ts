import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportMode } from '../../../profiles/transport-mode.enum';
import { FollowedTrip, FollowedTripSegment } from '../followed-trip.entity';

/**
 * Forme renvoyee par FollowedTripController (audit securite OWASP #262,
 * API3 - Broken Object Property Level Authorization) : allowlist explicite
 * des champs exposes, plutot que l'entite `FollowedTrip` directement - meme
 * raisonnement que MobilityProfileDto (voir profiles/dto/mobility-profile.dto.ts).
 */
export class FollowedTripDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 48.11 })
  originLat: number;

  @ApiProperty({ example: -1.68 })
  originLon: number;

  @ApiPropertyOptional({ example: 'République' })
  originLabel: string | null;

  @ApiProperty({ example: 48.12 })
  destinationLat: number;

  @ApiProperty({ example: -1.67 })
  destinationLon: number;

  @ApiPropertyOptional({ example: 'Gare' })
  destinationLabel: string | null;

  @ApiProperty({
    description:
      'mode/routeId/tripId de chaque segment - pas le trace complet.',
  })
  segments: FollowedTripSegment[];

  @ApiPropertyOptional({ enum: TransportMode, isArray: true })
  transportModes: TransportMode[] | null;

  @ApiProperty()
  endTime: Date;

  @ApiPropertyOptional()
  lastNotifiedDisruptionSignature: string | null;

  @ApiProperty()
  createdAt: Date;

  /** Construit le DTO de sortie a partir de l'entite - seuls les champs listes ci-dessus sont recopies, jamais la relation `user`. */
  static fromEntity(trip: FollowedTrip): FollowedTripDto {
    const dto = new FollowedTripDto();
    dto.id = trip.id;
    dto.userId = trip.userId;
    dto.originLat = trip.originLat;
    dto.originLon = trip.originLon;
    dto.originLabel = trip.originLabel;
    dto.destinationLat = trip.destinationLat;
    dto.destinationLon = trip.destinationLon;
    dto.destinationLabel = trip.destinationLabel;
    dto.segments = trip.segments;
    dto.transportModes = trip.transportModes;
    dto.endTime = trip.endTime;
    dto.lastNotifiedDisruptionSignature = trip.lastNotifiedDisruptionSignature;
    dto.createdAt = trip.createdAt;
    return dto;
  }
}
