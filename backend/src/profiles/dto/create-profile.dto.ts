import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
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
    description:
      'Accessibilite PMR (parametre de routage OpenTripPlanner correspondant)',
  })
  @IsBoolean()
  reducedMobility: boolean;

  @ApiPropertyOptional({ description: 'En metres. Absent = pas de limite.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxWalkingDistanceMeters?: number;

  @ApiPropertyOptional({ description: 'Absent = pas de limite.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxTransfers?: number;
}
