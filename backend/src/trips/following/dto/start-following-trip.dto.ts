import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TransportMode } from '../../../profiles/transport-mode.enum';

/**
 * Un segment de l'itineraire a suivre (POST /trips/current, issue #18) -
 * uniquement ce qui sert a la detection de perturbation
 * (TripDisruptionMonitorService), pas le trace/les couleurs/noms
 * d'affichage deja connus du frontend (voir FollowedTripSegment). Le
 * frontend extrait ces trois champs de l'itineraire deja recu de GET /trips
 * (TripSegment#mode/routeId/tripId), pas besoin de renvoyer la forme
 * complete.
 */
export class FollowedTripSegmentDto {
  @ApiProperty({ example: 'BUS' })
  @IsString()
  mode: string;

  @ApiPropertyOptional({ description: 'Absent pour un segment a pied' })
  @IsOptional()
  @IsString()
  routeId?: string;

  @ApiPropertyOptional({ description: 'Absent pour un segment a pied' })
  @IsOptional()
  @IsString()
  tripId?: string;
}

/**
 * Corps de POST /trips/current (issue #18) - demarre le suivi d'un
 * itineraire deja recu de GET /trips. Un seul suivi actif par utilisateur
 * (voir docs/specs/f3-scoring-perturbations-suivi.md section 2) : ce
 * endpoint remplace silencieusement un suivi precedent.
 */
export class StartFollowingTripDto {
  @ApiProperty({ example: 48.11 })
  @Type(() => Number)
  @IsLatitude()
  originLat: number;

  @ApiProperty({ example: -1.68 })
  @Type(() => Number)
  @IsLongitude()
  originLon: number;

  @ApiPropertyOptional({ example: 'République' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originLabel?: string;

  @ApiProperty({ example: 48.12 })
  @Type(() => Number)
  @IsLatitude()
  destinationLat: number;

  @ApiProperty({ example: -1.67 })
  @Type(() => Number)
  @IsLongitude()
  destinationLon: number;

  @ApiPropertyOptional({ example: 'Gare' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destinationLabel?: string;

  @ApiProperty({
    description:
      "Heure de fin de l'itineraire suivi (TripItinerary#endTime, ISO 8601) - le suivi expire automatiquement a cette heure (purge quotidienne, FollowedTripService#purgeExpired).",
  })
  @IsISO8601()
  endTime: string;

  @ApiProperty({ type: FollowedTripSegmentDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FollowedTripSegmentDto)
  segments: FollowedTripSegmentDto[];

  @ApiPropertyOptional({
    enum: TransportMode,
    isArray: true,
    description:
      'Modes demandes lors de la recherche initiale (issue #87) - conserves pour que le recalcul en cas de perturbation reste fidele a cette recherche.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TransportMode, { each: true })
  transportModes?: TransportMode[];
}
