import { ApiProperty } from '@nestjs/swagger';

/**
 * Forme renvoyee par POST /users - jamais l'entite User directement (elle
 * porte passwordHash). Sert uniquement a documenter la reponse dans
 * Swagger (voir UsersController#register, qui construit cet objet a la main).
 */
export class RegisteredUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'alice@example.com' })
  email: string;

  @ApiProperty()
  createdAt: Date;
}
