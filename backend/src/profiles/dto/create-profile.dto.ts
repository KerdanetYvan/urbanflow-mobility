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
  @IsArray()
  @IsEnum(TransportMode, { each: true })
  preferredTransportModes: TransportMode[];

  @IsBoolean()
  reducedMobility: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxWalkingDistanceMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxTransfers?: number;
}
