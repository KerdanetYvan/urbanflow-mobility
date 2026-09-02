import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

/**
 * Donnees attendues pour DELETE /users/me (issue #164, droit a l'effacement
 * RGPD article 17). Le mot de passe sert de confirmation explicite avant une
 * suppression definitive et irreversible - meme raisonnement que LoginDto :
 * pas de @Matches sur le pattern de mot de passe ici, on ne verifie qu'une
 * correspondance avec le hash deja enregistre (voir UsersService.remove),
 * pas une politique de robustesse (aucun interet a ce stade).
 */
export class DeleteAccountDto {
  @ApiProperty({
    example: 'MotDePasse123!',
    description:
      'Mot de passe du compte, requis pour confirmer la suppression definitive',
  })
  @IsNotEmpty({
    message: 'Le mot de passe est requis pour confirmer la suppression',
  })
  password: string;
}
