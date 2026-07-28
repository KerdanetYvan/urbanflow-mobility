import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './create-profile.dto';

/**
 * PATCH /profiles/me : toutes les proprietes de CreateProfileDto deviennent
 * optionnelles (mise a jour partielle - seuls les champs modifies par
 * l'utilisateur ont besoin d'etre envoyes).
 */
export class UpdateProfileDto extends PartialType(CreateProfileDto) {}
