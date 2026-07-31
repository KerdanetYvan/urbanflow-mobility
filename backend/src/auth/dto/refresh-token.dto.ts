import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

/** Donnees attendues pour POST /auth/refresh. */
export class RefreshTokenDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Le refresh token est requis' })
  refreshToken: string;
}
