import { IsNotEmpty } from 'class-validator';

/** Donnees attendues pour POST /auth/refresh. */
export class RefreshTokenDto {
  @IsNotEmpty({ message: 'Le refresh token est requis' })
  refreshToken: string;
}
