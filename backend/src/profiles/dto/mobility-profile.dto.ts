import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MobilityProfile } from '../mobility-profile.entity';
import { AccessibilityPreference } from '../accessibility-preference.enum';
import { TransportMode } from '../transport-mode.enum';

/**
 * Forme renvoyee par ProfilesController (audit securite OWASP #262, API3 -
 * Broken Object Property Level Authorization) : allowlist explicite des
 * champs exposes, plutot que de renvoyer l'entite `MobilityProfile`
 * directement. Rien de sensible ne fuit aujourd'hui via cette derniere (la
 * relation `user` - qui porterait `passwordHash` - n'est jamais chargee par
 * ProfilesService), mais une entite TypeORM n'offre aucune garantie
 * structurelle contre un futur champ sensible ajoute par erreur a la
 * serialisation - ce DTO en offre une, a la maniere de `TripHistoryEntryDto`
 * (voir trips/dto/trip-history-entry.dto.ts).
 */
export class MobilityProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ enum: TransportMode, isArray: true })
  preferredTransportModes: TransportMode[];

  @ApiProperty({ enum: AccessibilityPreference, isArray: true })
  accessibilityPreferences: AccessibilityPreference[];

  @ApiPropertyOptional({ example: 'Domicile' })
  homeLabel: string | null;

  @ApiPropertyOptional({ example: 48.111 })
  homeLat: number | null;

  @ApiPropertyOptional({ example: -1.682 })
  homeLon: number | null;

  @ApiPropertyOptional({ example: 'Travail' })
  workLabel: string | null;

  @ApiPropertyOptional({ example: 48.127 })
  workLat: number | null;

  @ApiPropertyOptional({ example: -1.682 })
  workLon: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  /** Construit le DTO de sortie a partir de l'entite - seuls les champs listes ci-dessus sont recopies, jamais la relation `user`. */
  static fromEntity(profile: MobilityProfile): MobilityProfileDto {
    const dto = new MobilityProfileDto();
    dto.id = profile.id;
    dto.userId = profile.userId;
    dto.preferredTransportModes = profile.preferredTransportModes;
    dto.accessibilityPreferences = profile.accessibilityPreferences;
    dto.homeLabel = profile.homeLabel;
    dto.homeLat = profile.homeLat;
    dto.homeLon = profile.homeLon;
    dto.workLabel = profile.workLabel;
    dto.workLat = profile.workLat;
    dto.workLon = profile.workLon;
    dto.createdAt = profile.createdAt;
    dto.updatedAt = profile.updatedAt;
    return dto;
  }
}
