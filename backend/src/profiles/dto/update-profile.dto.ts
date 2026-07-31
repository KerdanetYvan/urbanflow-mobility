import { PartialType } from '@nestjs/swagger';
import { CreateProfileDto } from './create-profile.dto';

/**
 * PATCH /profiles/me : toutes les proprietes de CreateProfileDto deviennent
 * optionnelles (mise a jour partielle - seuls les champs modifies par
 * l'utilisateur ont besoin d'etre envoyes).
 *
 * PartialType vient de @nestjs/swagger (pas @nestjs/mapped-types) : la
 * version swagger propage AUSSI les decorateurs @ApiProperty de
 * CreateProfileDto vers ce DTO (@nestjs/mapped-types ne propage que
 * class-validator), necessaire pour que PATCH /profiles/me soit documente
 * correctement.
 */
export class UpdateProfileDto extends PartialType(CreateProfileDto) {}
