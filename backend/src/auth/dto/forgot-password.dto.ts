import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** Donnees attendues pour POST /auth/forgot-password. */
export class ForgotPasswordDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;
}
