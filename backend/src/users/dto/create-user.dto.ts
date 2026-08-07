import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';
import {
  PASSWORD_MESSAGE,
  PASSWORD_PATTERN,
} from '../../common/validators/password.validator';

/**
 * Donnees attendues pour POST /users (inscription).
 *
 * class-validator verifie automatiquement ce DTO grace au ValidationPipe
 * global (voir main.ts) : une requete avec un email invalide ou un mot de
 * passe trop faible est rejetee en 400 avant meme d'atteindre le controleur,
 * avec un message d'erreur par champ (voir AllExceptionsFilter, qui sait
 * deja gerer ce format de message en tableau).
 */
export class CreateUserDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @ApiProperty({
    example: 'MotDePasse123!',
    description: PASSWORD_MESSAGE,
  })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;
}
