import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AccessibilityPreference } from '../accessibility-preference.enum';
import { TransportMode } from '../transport-mode.enum';

/** Donnees attendues pour POST /profiles (creation du profil de mobilite). */
export class CreateProfileDto {
  @ApiProperty({
    enum: TransportMode,
    isArray: true,
    example: [TransportMode.WALKING],
  })
  @IsArray()
  @IsEnum(TransportMode, { each: true })
  preferredTransportModes: TransportMode[];

  @ApiProperty({
    enum: AccessibilityPreference,
    isArray: true,
    example: [AccessibilityPreference.WHEELCHAIR_ACCESSIBLE],
  })
  @IsArray()
  @IsEnum(AccessibilityPreference, { each: true })
  accessibilityPreferences: AccessibilityPreference[];

  /**
   * Adresses domicile/travail (issue #113) - chacune une paire lat/lon
   * optionnelle + un libelle lisible optionnel. Une paire doit etre
   * complete ou totalement absente (verifie par ProfilesService, pas ici -
   * voir MobilityProfile). Meme style de champs plats que SearchTripsDto
   * (backend/src/trips/dto/search-trips.dto.ts), pas de DTO imbrique (aucun
   * precedent @ValidateNested dans ce projet).
   */
  @ApiPropertyOptional({ example: 'Domicile' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  homeLabel?: string;

  @ApiPropertyOptional({ example: 48.111 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  homeLat?: number;

  @ApiPropertyOptional({ example: -1.682 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  homeLon?: number;

  @ApiPropertyOptional({ example: 'Travail' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  workLabel?: string;

  @ApiPropertyOptional({ example: 48.127 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  workLat?: number;

  @ApiPropertyOptional({ example: -1.682 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  workLon?: number;
}
