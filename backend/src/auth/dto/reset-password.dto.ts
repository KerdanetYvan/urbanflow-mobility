import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';
import {
  PASSWORD_MESSAGE,
  PASSWORD_PATTERN,
} from '../../common/validators/password.validator';

/** Donnees attendues pour POST /auth/reset-password. */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token recu par email (extrait du lien de reinitialisation)',
  })
  @IsNotEmpty({ message: 'Le token est requis' })
  token: string;

  @ApiProperty({
    example: 'NouveauMotDePasse123!',
    description: PASSWORD_MESSAGE,
  })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
