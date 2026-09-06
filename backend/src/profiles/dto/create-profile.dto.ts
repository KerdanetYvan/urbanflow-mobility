import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AccessibilityPreference } from '../accessibility-preference.enum';
import { PROFILE_TRANSPORT_MODES, TransportMode } from '../transport-mode.enum';

/** Donnees attendues pour POST /profiles (creation du profil de mobilite). */
export class CreateProfileDto {
  /**
   * Modes de transport preferes. Valides contre PROFILE_TRANSPORT_MODES
   * (sous-ensemble de TransportMode), pas contre l'enum complet : trottinette
   * et covoiturage ne sont plus proposables dans un profil (issue #278, voir
   * le commentaire de PROFILE_TRANSPORT_MODES). Un client qui les enverrait
   * quand meme recoit une 400, comme pour n'importe quelle valeur inconnue.
   */
  @ApiProperty({
    enum: PROFILE_TRANSPORT_MODES,
    isArray: true,
    example: [TransportMode.WALKING],
  })
  @IsArray()
  @IsIn(PROFILE_TRANSPORT_MODES, { each: true })
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
