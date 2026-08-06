import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum } from 'class-validator';
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
}
