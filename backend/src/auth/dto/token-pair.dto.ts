import { ApiProperty } from '@nestjs/swagger';

/**
 * Documente la forme de TokenPair (voir auth.service.ts) pour Swagger -
 * classe separee plutot que l'interface elle-meme, qui ne peut pas porter
 * de decorateurs.
 */
export class TokenPairDto {
  @ApiProperty({
    description: 'Duree de vie courte (JWT_EXPIRATION, 15 min par defaut)',
  })
  accessToken: string;

  @ApiProperty({
    description:
      'Duree de vie longue (JWT_REFRESH_EXPIRATION, 7 jours par defaut)',
  })
  refreshToken: string;
}
